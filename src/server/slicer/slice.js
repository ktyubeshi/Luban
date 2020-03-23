import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';

import logger from '../lib/logger';
import { CURA_ENGINE_MACOS, CURA_ENGINE_WIN64, CURA_ENGINE_LINUX } from '../constants';
import DataStorage from '../DataStorage';
import { DefinitionLoader } from './definition';


const log = logger('print3d-slice');

let curaEnginePath;

// Determine path of Cura Engine
(() => {
    if (process.platform === 'darwin') {
        curaEnginePath = `${CURA_ENGINE_MACOS}`;
    } else if (process.platform === 'win32') {
        if (process.arch === 'x64') {
            curaEnginePath = `${CURA_ENGINE_WIN64}`;
        }
    } else if (process.platform === 'linux') {
        if (process.arch === 'x64') {
            curaEnginePath = CURA_ENGINE_LINUX;
        }
    }
    if (!curaEnginePath || !fs.existsSync(curaEnginePath)) {
        log.error(`Cura Engine not found: ${curaEnginePath}`);
    }
})();

function callCuraEngine(modelPath, configPath, outputPath) {
    return childProcess.spawn(
        curaEnginePath,
        ['slice', '-v', '-p', '-j', configPath, '-o', outputPath, '-l', modelPath]
    );
}

let sliceProgress, filamentLength, filamentWeight, printTime;

function processGcodeHeaderAfterCuraEngine(gcodeFilePath, boundingBox, thumbnail) {
    const definitionLoader = new DefinitionLoader();
    definitionLoader.loadDefinition('active_final');
    const readFileSync = fs.readFileSync(gcodeFilePath, 'utf8');

    const date = new Date();
    const splitIndex = readFileSync.indexOf(';Generated');
    const boundingBoxMax = (boundingBox || { max: { x: 0, y: 0, z: 0 } }).max;
    const boundingBoxMin = (boundingBox || { min: { x: 0, y: 0, z: 0 } }).min;
    const header = ';Header Start\n'
        + '\n'
        + `${readFileSync.substring(0, splitIndex)}\n`
        + ';header_type: 3dp\n'
        + `;thumbnail: ${thumbnail}\n`
        + `;file_total_lines: ${readFileSync.split('\n').length + 20}\n`
        + `;estimated_time(s): ${printTime}\n`
        + `;nozzle_temperature(°C): ${definitionLoader.settings.material_print_temperature.default_value}\n`
        + `;build_plate_temperature(°C): ${definitionLoader.settings.material_bed_temperature_layer_0.default_value}\n`
        + `;work_speed(mm/minute): ${definitionLoader.settings.speed_infill.default_value * 60}\n`
        + `;max_x(mm): ${boundingBoxMax.x}\n`
        + `;max_y(mm): ${boundingBoxMax.y}\n`
        + `;max_z(mm): ${boundingBoxMax.z}\n`
        + `;min_x(mm): ${boundingBoxMin.x}\n`
        + `;min_y(mm): ${boundingBoxMin.y}\n`
        + `;min_z(mm): ${boundingBoxMin.z}\n`
        + '\n'
        + ';Header End\n'
        + '\n'
        + '; G-code for 3dp engraving\n'
        + '; Generated by Snapmaker Luban\n'
        + `; ${date.toDateString()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}\n`
        + '\n';
    const nextSplitIndex = readFileSync.indexOf('\n', splitIndex) + 1;
    fs.writeFileSync(gcodeFilePath, header + readFileSync.substring(nextSplitIndex));
}

function slice(params, onProgress, onSucceed, onError) {
    if (!fs.existsSync(curaEnginePath)) {
        log.error(`Cura Engine not found: ${curaEnginePath}`);
        onError(`Slice Error: Cura Engine not found: ${curaEnginePath}`);
        return;
    }

    const { originalName, uploadName, boundingBox, thumbnail } = params;

    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;

    if (!fs.existsSync(uploadPath)) {
        log.error(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
        onError(`Slice Error: 3d model file does not exist -> ${uploadPath}`);
        return;
    }

    const configFilePath = `${DataStorage.configDir}/active_final.def.json`;

    const gcodeFileName = {
        originalName,
        uploadName: `${path.parse(uploadName).name}.gcode`
    };
    const gcodeFilePath = `${DataStorage.tmpDir}/${gcodeFileName.uploadName}`;
    const process = callCuraEngine(uploadPath, configFilePath, gcodeFilePath);

    process.stderr.on('data', (data) => {
        const array = data.toString().split('\n');

        array.map((item) => {
            if (item.length < 10) {
                return null;
            }
            if (item.indexOf('Progress:inset+skin:') === 0 || item.indexOf('Progress:export:') === 0) {
                const start = item.indexOf('0.');
                const end = item.indexOf('%');
                sliceProgress = Number(item.slice(start, end));
                onProgress(sliceProgress);
            } else if (item.indexOf(';Filament used:') === 0) {
                filamentLength = Number(item.replace(';Filament used:', '').replace('m', ''));
                filamentWeight = Math.PI * (1.75 / 2) * (1.75 / 2) * filamentLength * 1.24;
            } else if (item.indexOf('Print time (s):') === 0) {
                // Times empirical parameter: 1.07
                printTime = Number(item.replace('Print time (s):', '')) * 1.07;
            }
            return null;
        });
    });

    process.on('close', (code) => {
        if (filamentLength && filamentWeight && printTime) {
            sliceProgress = 1;
            onProgress(sliceProgress);
            processGcodeHeaderAfterCuraEngine(gcodeFilePath, boundingBox, thumbnail);

            onSucceed({
                gcodeFileName: gcodeFileName,
                printTime: printTime,
                filamentLength: filamentLength,
                filamentWeight: filamentWeight,
                gcodeFilePath: gcodeFilePath
            });
        }
        log.info(`slice progress closed with code ${code}`);
    });
}

export default slice;
