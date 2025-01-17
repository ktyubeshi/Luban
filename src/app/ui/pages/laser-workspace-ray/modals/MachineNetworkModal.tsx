import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { IPObtain, NetworkConfiguration, NetworkMode, NetworkStationState } from '@snapmaker/snapmaker-sacp-sdk/dist/models';
import { Alert, Input, Select, Space } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import ControllerEvent from '../../../../connection/controller-events';
import { RootState } from '../../../../flux/index.def';
import { ConnectionType } from '../../../../flux/workspace/state';
import controller from '../../../../lib/controller';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';

interface MachineNetworkModalProps {
    onClose?: () => void;
}

/**
 * Configure Machine Network (Wi-Fi).
 */
const MachineNetworkModal: React.FC<MachineNetworkModalProps> = (props) => {
    const isConnected = useSelector((state: RootState) => state.workspace.isConnected);
    const connectionType = useSelector((state: RootState) => state.workspace.connectionType);


    const isConnectedViaSerialport = useMemo(() => {
        return isConnected && connectionType === ConnectionType.Serial;
    }, [isConnected, connectionType]);

    // Current network
    const [currentNetwork, setCurrentNetwork] = useState('');
    const [currentNetworkIP, setCurrentNetworkIP] = useState('');

    useEffect(() => {
        if (isConnectedViaSerialport) {
            controller
                .emitEvent(ControllerEvent.GetMachineNetworkConfiguration)
                .once(ControllerEvent.GetMachineNetworkConfiguration, (networkConfiguration: NetworkConfiguration) => {
                    if (networkConfiguration.networkMode === NetworkMode.Station) {
                        setCurrentNetwork(networkConfiguration.stationSSID);
                        controller
                            .emitEvent(ControllerEvent.GetMachineNetworkStationState)
                            .once(ControllerEvent.GetMachineNetworkStationState, (networkStationState: NetworkStationState) => {
                                if (networkStationState.stationState === 3) {
                                    setCurrentNetworkIP(networkStationState.stationIP);
                                }
                            });
                    }
                });
        }
    }, [isConnectedViaSerialport]);

    // Network options
    const [networkOptions, setNetworkOptions] = useState([]);
    const [networkLoading, setNetworkLoading] = useState(false);

    useEffect(() => {
        if (isConnectedViaSerialport) {
            setNetworkLoading(true);

            controller
                .emitEvent(ControllerEvent.ListWiFiNetworks)
                .once(ControllerEvent.ListWiFiNetworks, (networks: string[]) => {
                    const options = networks.map((network: string) => ({
                        value: network,
                        label: network,
                    }));
                    setNetworkLoading(false);
                    setNetworkOptions(options);
                });
        }
    }, [isConnectedViaSerialport]);

    // selected SSID
    const [selectedNetwork, setSelecetdNetwork] = useState('');

    const [selectedNetworkPassword, setSelectedNetworkPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = React.useState(false);

    useEffect(() => {
        if (!selectedNetwork && networkOptions.length > 0) {
            setSelecetdNetwork(networkOptions[0].value);
        }
    }, [selectedNetwork, networkOptions]);

    const onChangeSelectedNetwork = useCallback((networkOption) => {
        setSelecetdNetwork(networkOption);
    }, []);

    const onChangePassword = useCallback((e) => {
        setSelectedNetworkPassword(e.target.value);
    }, []);

    // Connect
    const onConnect = useCallback(() => {
        console.log('onConnect', selectedNetwork);

        controller
            .emitEvent(ControllerEvent.SetMachineNetworkConfiguration, {
                networkMode: NetworkMode.Station,
                stationIPObtain: IPObtain.DHCP,
                stationSSID: selectedNetwork,
                stationPassword: selectedNetworkPassword,
                stationIP: '0.0.0.0',
            });
    }, [selectedNetwork, selectedNetworkPassword]);

    return (
        <Modal size="sm" onClose={props?.onClose}>
            <Modal.Header>
                {i18n._('key-Workspace/MainToolBar-Machine Network')}
            </Modal.Header>
            <Modal.Body className="width-400">
                {
                    !isConnected && (
                        <Alert
                            type="error"
                            message={i18n._('key-Workspace/Machine not connected, please connect to the machine first.')}
                        />
                    )
                }
                {
                    isConnectedViaSerialport && (
                        <div>
                            <p>
                                Current Machine Network:
                                <span>{currentNetwork}</span>
                                {currentNetworkIP && <span>({currentNetworkIP})</span>}
                            </p>
                        </div>
                    )
                }
                <div
                    className={
                        classNames('width-percent-100', 'sm-flex', {
                            'margin-top-16': !isConnected,
                        })
                    }
                >
                    <Space direction="vertical" size={16} className="sm-flex-width">
                        <div className="width-320">
                            <p>Network:</p>
                            <Select
                                style={{ width: '100%' }}
                                disabled={!isConnected}
                                loading={networkLoading}
                                options={networkOptions}
                                value={selectedNetwork}
                                onChange={onChangeSelectedNetwork}
                            />
                        </div>
                        <div className="width-320">
                            <p>Password:</p>
                            <Input.Password
                                width={300}
                                disabled={!isConnected}
                                value={selectedNetworkPassword}
                                onChange={onChangePassword}
                                placeholder={i18n._('key-Workspace/Input password')}
                                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                                visibilityToggle={{ visible: passwordVisible, onVisibleChange: setPasswordVisible }}
                            />
                        </div>
                    </Space>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type="primary"
                    className="align-r"
                    width="96px"
                    onClick={onConnect}
                    disabled={!isConnected}
                >
                    {i18n._('key-Common/Config')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default MachineNetworkModal;
