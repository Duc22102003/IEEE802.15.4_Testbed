    // Global Variables
    let nodeCounter = 0;
    let availablePorts = [];
    let activeNodes = new Set();
    let pollingIntervals = {};
    let escanIntervals = {};
    let eventDisplayCounts = {};
    let nodeDataCache = {};
    let nodeStartTimes = {};
    let isReconnecting = false;

    // BER Test variables
    let berTestNodes = { node1: false, node2: false };
    let berTestRunning = false;

    // Package Detail Modal Variables
    let currentPacketDetail = null;

    // Utility Functions
    function updateRealTimeClock() {
        const now = new Date();
        $('#realTimeClock').html(`${now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })} | ${now.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit'
        })}`);
    }

    function createTimeCell(packet, nodeId) {
        const timeValue = packet.TimeUs || packet.Time || 'N/A';
        const realTime = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
        const isOverflow = packet.IsOverflow || false;
        const tooltip = packet.Tooltip || `Packet received at ${realTime}`;
        const overflowClass = isOverflow ? ' overflow' : '';
        
        return `<td class="time-cell${overflowClass}">
            <div>${timeValue}</div>
            <div class="real-time">${realTime}</div>
            <div class="time-tooltip">${tooltip}</div>
        </td>`;
    }

    function createID64Cell(packet) {
        const id64 = packet.ID64 || 'N/A';
        return `<td class="id64-cell">${id64}</td>`;
    }

    // Server Cleanup Function
    function cleanupServer() {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: '/cleanup_all_nodes',
                type: 'POST',
                timeout: 15000,
                success: function(response) {
                    console.log('✅ Server cleanup successful:', response);
                    resolve(response);
                },
                error: function(xhr, status, error) {
                    console.warn('⚠️ Server cleanup failed:', error);
                    // Vẫn resolve để tiếp tục process
                    resolve({ status: 'warning', message: 'Server cleanup failed but continuing' });
                }
            });
        });
    }

    // Package Detail Modal Functions
    function showPackageDetail(packet, nodeId) {
        currentPacketDetail = packet;
        
        // Populate basic information
        $('#modalEvent').text(packet.Event || 'N/A');
        $('#modalID64').text(packet.ID64 || 'N/A');
        $('#modalTime').text(packet.TimeUs || packet.Time || 'N/A');
        
        const modalRealTime = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
        $('#modalRealTime').text(modalRealTime);
        
        $('#modalRSSI').text(packet.RSSI || 'N/A');
        $('#modalChannel').text(packet.Channel ? `Ch${packet.Channel}` : 'N/A');
        $('#modalLength').text(packet.Length || '0');
        $('#modalPackageType').text(packet.TypePackage || 'Unknown');
        $('#modalLQI').text(packet.LQI || 'N/A');
        $('#modalCRCPass').text(packet.CRCPass || 'N/A');
        // $('#modalSyncWord').text(packet.SyncWord || 'N/A');
        // $('#modalAntennaID').text(packet.AntenaID || 'N/A');

        // Request detailed packet analysis from server
        $.ajax({
            url: `/get_packet_detail/${nodeId}`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ packet: packet }),
            success: function(response) {
                if (response.status === 'success') {
                    populatePacketDetail(response.detail);
                } else {
                    populatePacketDetailFallback(packet);
                }
            },
            error: function() {
                console.error('Failed to get packet detail, using fallback');
                populatePacketDetailFallback(packet);
            }
        });

        $('#packageDetailModal').show();
    }

    function populatePacketDetail(detail) {
        resetProtocolSections();
        
        if (detail.Interface) {
            populateIEEE802154(detail.Interface);
        }

        if (detail.ZigbeeNet && detail.ZigbeeNet.FrameControl && detail.ZigbeeNet.FrameControl.FrameControl) {
            $('#zigbeeNetworkSection').show();
            populateZigBeeNetwork(detail.ZigbeeNet);
        }

        if (detail.ZigbeeNetSec && detail.ZigbeeNetSec.FrameControl && detail.ZigbeeNetSec.FrameControl.FrameControl) {
            $('#zigbeeSecuritySection').show();
            populateZigBeeSecurity(detail.ZigbeeNetSec);
        }

        if (detail.ApplicationPayload && detail.ApplicationPayload.length > 0) {
            $('#applicationPayloadSection').show();
            populateApplicationPayload(detail.ApplicationPayload);
        }

        if (detail.DataBytes && detail.DataBytes.length > 0) {
            populateRawData(detail.DataBytes);
        }
    }

    function populatePacketDetailFallback(packet) {
        resetProtocolSections();
        
        if (packet.Length && parseInt(packet.Length) > 0) {
            $('#packetLength').text(`${packet.Length} bytes`);
            $('#ieee802154Length').text(`[${packet.Length} bytes]`);
        }
        
        if (packet.Payload && packet.Payload.length > 0) {
            $('#applicationPayloadSection').show();
            populateApplicationPayload(packet.Payload);
        }
        
        if (packet.DataBytes && packet.DataBytes.length > 0) {
            populateRawData(packet.DataBytes);
        } else if (packet.Payload) {
            populateRawData(packet.Payload);
        }
    }

    function resetProtocolSections() {
        $('#zigbeeNetworkSection').hide();
        $('#zigbeeSecuritySection').hide();
        $('#applicationPayloadSection').hide();
        
        $('#frameControlBits').empty();
        $('#nwkFrameControlBits').empty();
        $('#payloadHexDump').empty();
        $('#rawDataHexDump').empty();
    }

    function populateIEEE802154(ieee) {
        if (ieee.PHYHeader) {
            const length = parseInt(ieee.PHYHeader, 16);
            $('#packetLength').text(`${length} bytes (0x${ieee.PHYHeader})`);
            $('#ieee802154Length').text(`[${length} bytes]`);
        }

        if (ieee.FrameControl) {
            populateFrameControl(ieee.FrameControl);
        }

        $('#sequenceNumber').text(ieee.Sequence || 'N/A');
        $('#destPanId').text(ieee.DestinationPANID || 'N/A');
        $('#destAddr').text(ieee.ShortDestinationAddr || 'N/A');
        $('#sourceAddr').text(ieee.ShortSouceAddr || 'N/A');
    }

    function populateFrameControl(fc) {
        $('#frameControlValue').text(`0x${fc.FrameControl || '0000'}`);
        
        if (fc.FrameControl) {
            const fcfValue = parseInt(fc.FrameControl, 16);
            const bitsHtml = generateFrameControlBits(fcfValue, fc);
            $('#frameControlBits').html(bitsHtml);
        }
    }

    function generateFrameControlBits(fcfValue, fc) {
        const frameType = fcfValue & 0x07;
        const security = (fcfValue >> 3) & 0x01;
        const pending = (fcfValue >> 4) & 0x01;
        const ack = (fcfValue >> 5) & 0x01;
        const pan = (fcfValue >> 6) & 0x01;
        const destMode = (fcfValue >> 10) & 0x03;
        const version = (fcfValue >> 12) & 0x03;
        const srcMode = (fcfValue >> 14) & 0x03;

        return `
            <div class="bit-field">
                <span class="bit-pattern">.... .... .... .${frameType.toString(2).padStart(3, '0')}</span>
                <span class="bit-description">Frame Type: ${fc.FrameType || 'Unknown'} (${frameType})</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.... .... .... ${security}...</span>
                <span class="bit-description">Security Enabled: ${fc.SecurityEn || 'false'}</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.... .... ...${pending} ....</span>
                <span class="bit-description">Frame Pending: ${fc.FramePending || 'false'}</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.... .... ..${ack}. ....</span>
                <span class="bit-description">ACK Required: ${fc.AckRequied || 'false'}</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.... .... .${pan}.. ....</span>
                <span class="bit-description">PAN ID Compression: ${fc.PanIDCompression || 'false'}</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">..${destMode.toString(2).padStart(2, '0')} .... .... ....</span>
                <span class="bit-description">Destination Address Mode: ${fc.DestinationAddrMode || 'Unknown'} (${destMode})</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.${version.toString(2).padStart(2, '0')}. .... .... ....</span>
                <span class="bit-description">Frame Version: 802.15.4-2003 (${version})</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">${srcMode.toString(2).padStart(2, '0')}.. .... .... ....</span>
                <span class="bit-description">Source Address Mode: ${fc.SouceAddrMode || 'Unknown'} (${srcMode})</span>
            </div>
        `;
    }

    function populateZigBeeNetwork(zigbee) {
        $('#nwkFrameControl').text(`0x${zigbee.FrameControl.FrameControl || '0000'}`);
        $('#nwkDestAddr').text(zigbee.DestinationAddr || 'N/A');
        $('#nwkSourceAddr').text(zigbee.SouceAddr || 'N/A');
        $('#nwkRadius').text(zigbee.Radius || 'N/A');
        $('#nwkSequence').text(zigbee.Sequence || 'N/A');
        $('#zigbeeNetworkLength').text('[Variable bytes]');

        if (zigbee.FrameControl.FrameControl) {
            const nwkFcfValue = parseInt(zigbee.FrameControl.FrameControl, 16);
            const bitsHtml = generateNetworkFrameControlBits(nwkFcfValue, zigbee.FrameControl);
            $('#nwkFrameControlBits').html(bitsHtml);
        }
    }

    function generateNetworkFrameControlBits(nwkFcfValue, nfc) {
        const frameType = nwkFcfValue & 0x03;
        const protocolVersion = (nwkFcfValue >> 2) & 0x0F;
        const discoverRoute = (nwkFcfValue >> 6) & 0x03;
        const multicast = (nwkFcfValue >> 8) & 0x01;
        const security = (nwkFcfValue >> 9) & 0x01;

        return `
            <div class="bit-field">
                <span class="bit-pattern">.... .... .... ..${frameType.toString(2).padStart(2, '0')}</span>
                <span class="bit-description">Frame Type: ${nfc.FrameType || 'Unknown'} (${frameType})</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.... .... ${protocolVersion.toString(2).padStart(4, '0')} ....</span>
                <span class="bit-description">Protocol Version: ${nfc.ProtocoVersion || 'Unknown'}</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.... ..${discoverRoute.toString(2).padStart(2, '0')} .... ....</span>
                <span class="bit-description">Discover Route: ${nfc.DiscoverRouter || 'Unknown'}</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.... .${multicast}.. .... ....</span>
                <span class="bit-description">Multicast: ${nfc.Multicast || 'false'}</span>
            </div>
            <div class="bit-field">
                <span class="bit-pattern">.... ${security}... .... ....</span>
                <span class="bit-description">Security: ${nfc.Security || 'false'}</span>
            </div>
        `;
    }

    function populateZigBeeSecurity(security) {
        $('#securityLevel').text(security.FrameControl.SecurityLevel || 'N/A');
        $('#keyIdentifier').text(security.FrameControl.KeyIdentifer || 'N/A');
        $('#extendedNonce').text(security.FrameControl.ExtenedNonce || 'N/A');
        $('#frameCounter').text(security.FrameCouter || 'N/A');
        $('#secSourceAddr').text(security.SouceAddr || 'N/A');
        $('#keySequence').text(security.KeySequence || 'N/A');
        $('#zigbeeSecurityLength').text('[Variable bytes]');
    }

    function populateApplicationPayload(payload) {
        const payloadArray = Array.isArray(payload) ? payload : [];
        $('#payloadLength').text(`[${payloadArray.length} bytes]`);
        
        let hexDump = '';
        for (let i = 0; i < payloadArray.length; i += 16) {
            const line = payloadArray.slice(i, i + 16);
            const hexStr = line.map(byte => {
                if (typeof byte === 'string') {
                    return byte.toUpperCase().padStart(2, '0');
                } else {
                    return byte.toString(16).toUpperCase().padStart(2, '0');
                }
            }).join(' ');
            
            const asciiStr = line.map(byte => {
                const val = typeof byte === 'string' ? parseInt(byte, 16) : byte;
                return (val >= 32 && val <= 126) ? String.fromCharCode(val) : '.';
            }).join('');
            
            hexDump += `<div class="hex-line">
                <span class="hex-offset">${i.toString(16).padStart(4, '0').toUpperCase()}:</span>
                <span class="hex-bytes">${hexStr.padEnd(47, ' ')}</span>
                <span class="hex-ascii">${asciiStr}</span>
            </div>`;
        }
        $('#payloadHexDump').html(hexDump || '<div class="hex-line">No payload data</div>');
    }

    function populateRawData(dataBytes) {
        const rawArray = Array.isArray(dataBytes) ? dataBytes : [];
        $('#rawDataLength').text(`[${rawArray.length} bytes]`);
        
        let hexDump = '';
        for (let i = 0; i < rawArray.length; i += 16) {
            const line = rawArray.slice(i, i + 16);
            const hexStr = line.map(byte => {
                if (typeof byte === 'string') {
                    return byte.toUpperCase().padStart(2, '0');
                } else {
                    return byte.toString(16).toUpperCase().padStart(2, '0');
                }
            }).join(' ');
            
            const asciiStr = line.map(byte => {
                const val = typeof byte === 'string' ? parseInt(byte, 16) : byte;
                return (val >= 32 && val <= 126) ? String.fromCharCode(val) : '.';
            }).join('');
            
            hexDump += `<div class="hex-line">
                <span class="hex-offset">${i.toString(16).padStart(4, '0').toUpperCase()}:</span>
                <span class="hex-bytes">${hexStr.padEnd(47, ' ')}</span>
                <span class="hex-ascii">${asciiStr}</span>
            </div>`;
        }
        $('#rawDataHexDump').html(hexDump || '<div class="hex-line">No raw data available</div>');
    }

    // State Management với cleanup
    function saveAppState() {
        const appState = {
            nodeCounter: nodeCounter,
            activeNodes: Array.from(activeNodes),
            eventDisplayCounts: eventDisplayCounts,
            nodeDataCache: nodeDataCache,
            nodeStartTimes: nodeStartTimes,
            nodes: []
        };
        
        $('.node-panel').each(function() {
            const nodeId = $(this).attr('id');
            const deviceType = $(this).hasClass('coordinator') ? 'coordinator' : 'end-device';
            const port = $(`#${nodeId}_port`).val();
            const baudrate = $(`#${nodeId}_baudrate`).val();
            const isConnected = $(`#${nodeId}_status`).hasClass('connected');
            const isCollapsed = $(`#${nodeId}_content`).hasClass('collapsed');
            
            appState.nodes.push({
                nodeId, deviceType, port, baudrate, isConnected, isCollapsed
            });
        });
        
        localStorage.setItem('zigbeeControllerState', JSON.stringify(appState));
    }

    async function loadAppState() {
        const savedState = localStorage.getItem('zigbeeControllerState');
        if (!savedState) return false;
        
        try {
            // CLEANUP SERVER TRƯỚC KHI LOAD STATE
            console.log('🔧 Cleaning up server before loading state...');
            await cleanupServer();
            
            const appState = JSON.parse(savedState);
            nodeCounter = appState.nodeCounter || 0;
            eventDisplayCounts = appState.eventDisplayCounts || {};
            nodeDataCache = appState.nodeDataCache || {};
            nodeStartTimes = appState.nodeStartTimes || {};
            
            // Tạo nodes từ saved state
            appState.nodes.forEach(nodeData => {
                createNodeFromData(nodeData);
                if (nodeDataCache[nodeData.nodeId]) {
                    restoreNodeData(nodeData.nodeId, nodeDataCache[nodeData.nodeId]);
                }
            });
            
            // RECONNECT CÁC NODES SAU KHI CLEANUP
            if (appState.activeNodes && appState.activeNodes.length > 0) {
                console.log('🔄 Starting reconnection process...');
                isReconnecting = true;
                
                // Delay để đảm bảo server đã cleanup xong
                setTimeout(async () => {
                    for (const nodeId of appState.activeNodes) {
                        const nodeData = appState.nodes.find(n => n.nodeId === nodeId);
                        if (nodeData && nodeData.isConnected && nodeData.port) {
                            console.log(`🔌 Reconnecting ${nodeId} to ${nodeData.port}...`);
                            await reconnectNodeSafe(nodeId, nodeData.port, nodeData.baudrate);
                            // Delay giữa các reconnection
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        }
                    }
                    isReconnecting = false;
                    console.log('✅ Reconnection process completed');
                }, 2000);
            }
            
            updateNodeCount();
            return true;
        } catch (error) {
            console.error('❌ Error loading app state:', error);
            localStorage.removeItem('zigbeeControllerState');
            return false;
        }
    }

    function clearAppState() {
        localStorage.removeItem('zigbeeControllerState');
        nodeDataCache = {};
        nodeStartTimes = {};
    }

    function saveNodeData(nodeId, dataType, data) {
        if (!nodeDataCache[nodeId]) {
            nodeDataCache[nodeId] = { events: [], packets: [], escan: {} };
        }
        
        if (dataType === 'events') {
            nodeDataCache[nodeId].events = data.slice(-50);
        } else if (dataType === 'packets') {
            nodeDataCache[nodeId].packets = data.slice(-100);
        } else if (dataType === 'escan') {
            nodeDataCache[nodeId].escan = data;
        }
        
        saveAppState();
    }

    function restoreNodeData(nodeId, cachedData) {
        if (cachedData.events && cachedData.events.length > 0) {
            updateEventsTable(nodeId, cachedData.events);
        }
        if (cachedData.packets && cachedData.packets.length > 0) {
            updatePacketsTable(nodeId, cachedData.packets);
        }
        if (cachedData.escan && Object.keys(cachedData.escan).length > 0) {
            updateEScanTable(nodeId, cachedData.escan);
            $(`#${nodeId}_escan_container`).show();
        }
    }

    // Safe Reconnection Function
    async function reconnectNodeSafe(nodeId, port, baudrate) {
        if (!port) return false;
        
        const $btn = $(`#${nodeId}_toggle`);
        const $status = $(`#${nodeId}_status`);
        
        $btn.prop('disabled', true).html('<span class="loading"></span> Reconnecting...');
        
        try {
            const response = await $.ajax({
                url: '/open_port',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    node_id: nodeId,
                    port: port,
                    baudrate: parseInt(baudrate)
                }),
                timeout: 20000
            });

            if (response.status === 'success') {
                $btn.text('Close Port').prop('disabled', false);
                $status.addClass('connected');
                $(`#${nodeId} .zigbee-controls button`).prop('disabled', false);
                $(`#${nodeId}_escan_btn`).prop('disabled', false);
                updateCloseDeviceButton(nodeId, true);
                activeNodes.add(nodeId);
                startPolling(nodeId);
                showMessage(nodeId, `✅ Reconnected to ${port}`, 'success');
                console.log(`✅ ${nodeId} reconnected successfully`);
                return true;
            } else {
                throw new Error(response.message || 'Unknown error');
            }
        } catch (error) {
            console.error(`❌ Reconnection failed for ${nodeId}:`, error);
            showMessage(nodeId, `❌ Reconnection failed: ${error.responseJSON?.message || error.message || 'Unknown error'}`, 'error');
            $btn.text('Open Port').prop('disabled', false);
            return false;
        } finally {
            updateNodeCount();
        }
    }

    // Message Functions
    function showMessage(nodeId, message, type = 'success') {
        const messageDiv = $(`#${nodeId} .messages`);
        const messageHtml = `<div class="message ${type}">${message}</div>`;
        messageDiv.html(messageHtml);
        setTimeout(() => messageDiv.empty(), 5000);
    }

    // Port Management
    function updatePortOptions() {
        $('.port-select').each(function() {
            const currentValue = $(this).val();
            $(this).empty().append('<option value="">Select COM Port</option>');
            availablePorts.forEach(port => {
                const selected = port === currentValue ? 'selected' : '';
                $(this).append(`<option value="${port}" ${selected}>${port}</option>`);
            });
        });
    }

    function reloadPorts() {
        $.ajax({
            url: '/refresh_ports',
            type: 'GET',
            success: function(ports) {
                availablePorts = ports;
                updatePortOptions();
                console.log('Ports reloaded:', ports);
            },
            error: function(xhr, status, error) {
                console.error('Error reloading ports:', error);
                alert('Server connection error. Please check if server is running.');
            }
        });
    }

    // Node Management
    function updateNodeCount() {
        $('#nodeCount').text(`${activeNodes.size} Nodes Active`);
    }

    function createNode(deviceType) {
        nodeCounter++;
        const nodeId = `${deviceType}_${nodeCounter}`;
        const isCoordinator = deviceType === 'coordinator';
        const deviceName = isCoordinator ? 'COORDINATOR' : 'END DEVICE';
        
        eventDisplayCounts[nodeId] = 10;
        
        const nodeHtml = createNodeHTML(nodeId, deviceType, deviceName, isCoordinator);
        $('#nodesContainer').append(nodeHtml);
        setupNodeEvents(nodeId, deviceType);
        updatePortOptions();
        updateNodeCount();
        saveAppState();
    }

    function createNodeFromData(nodeData) {
        const { nodeId, deviceType, port, baudrate, isCollapsed } = nodeData;
        const isCoordinator = deviceType === 'coordinator';
        const deviceName = isCoordinator ? 'COORDINATOR' : 'END DEVICE';
        const nodeNumber = parseInt(nodeId.split('_')[1]);
        
        if (nodeNumber > nodeCounter) {
            nodeCounter = nodeNumber;
        }
        
        const nodeHtml = createNodeHTML(nodeId, deviceType, deviceName, isCoordinator, isCollapsed, port, baudrate);
        $('#nodesContainer').append(nodeHtml);
        setupNodeEvents(nodeId, deviceType);
        
        setTimeout(() => {
            if (port) {
                $(`#${nodeId}_port`).val(port);
            }
        }, 100);
    }

    function createNodeHTML(nodeId, deviceType, deviceName, isCoordinator, isCollapsed = false, port = '', baudrate = '115200') {
        const ledControls = isCoordinator ? 
            `<button class="btn-node btn-led" id="${nodeId}_toggle_led" disabled>Toggle LED</button>
            <div class="led-status" id="${nodeId}_led_status">
                <span class="led-indicator" id="${nodeId}_led_indicator"></span>
                <span>LED: <span id="${nodeId}_led_text">Unknown</span></span>
            </div>` :
            `<button class="btn-node btn-led-on" id="${nodeId}_turn_on_led" disabled>Turn ON LED</button>
            <button class="btn-node btn-led-off" id="${nodeId}_turn_off_led" disabled>Turn OFF LED</button>`;
        
        const zigbeeControls = isCoordinator ?
            `<div class="zigbee-controls">
                <button class="btn-node btn-reset" id="${nodeId}_reset" disabled>Reset Node</button>
                <button class="btn-node btn-network" id="${nodeId}_create_network" disabled>Create Network</button>
                <button class="btn-node btn-network" id="${nodeId}_open_network" disabled>Open Network</button>
                ${ledControls}
            </div>` :
            `<div class="zigbee-controls">
                <button class="btn-node btn-reset" id="${nodeId}_reset" disabled>Reset Node</button>
                <button class="btn-node btn-network" id="${nodeId}_leave_network" disabled>Leave Network</button>
                <button class="btn-node btn-network" id="${nodeId}_join_network" disabled>Join Network</button>
                ${ledControls}
            </div>`;
        
        return `<div class="node-panel ${deviceType}" id="${nodeId}">
            <button class="close-device-btn" id="${nodeId}_close_device" title="Close Device">×</button>
            <div class="node-header ${deviceType}" id="${nodeId}_header">
                <span class="node-title">
                    ${nodeId.toUpperCase()}
                    <span class="device-badge">${deviceName}</span>
                </span>
                <div class="header-controls">
                    <span class="status-indicator" id="${nodeId}_status"></span>
                    <button class="collapse-btn" id="${nodeId}_collapse" title="Collapse/Expand">${isCollapsed ? '+' : '−'}</button>
                </div>
            </div>
            <div class="node-content ${isCollapsed ? 'collapsed' : ''}" id="${nodeId}_content">
                <div class="messages"></div>
                <div class="control-row">
                    <select class="form-control port-select" id="${nodeId}_port">
                        <option value="">Select COM Port</option>
                    </select>
                    <select class="form-control" id="${nodeId}_baudrate">
                        <option value="115200" ${baudrate === '115200' ? 'selected' : ''}>115200</option>
                        <option value="9600" ${baudrate === '9600' ? 'selected' : ''}>9600</option>
                        <option value="57600" ${baudrate === '57600' ? 'selected' : ''}>57600</option>
                    </select>
                    <button class="btn-node" id="${nodeId}_toggle">Open Port</button>
                </div>
                <div class="tabs">
                    <div class="tab active" data-tab="control" data-node="${nodeId}">Control</div>
                    <div class="tab" data-tab="escan" data-node="${nodeId}">Energy Scan</div>
                    <div class="tab" data-tab="packets" data-node="${nodeId}">Packets</div>
                    <div class="tab" data-tab="cli" data-node="${nodeId}">CLI</div>
                </div>
                <div class="tab-content active" id="${nodeId}_control">
                    ${zigbeeControls}
                    <div class="section-header events">
                        <span>Events (Length = 0)</span>
                        <div class="event-controls">
                            <label for="${nodeId}_event_count">Show:</label>
                            <select id="${nodeId}_event_count" class="event-count-select" data-node="${nodeId}">
                                <option value="5">5 Events</option>
                                <option value="10" selected>10 Events</option>
                                <option value="20">20 Events</option>
                                <option value="50">50 Events</option>
                            </select>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="event-table">
                            <thead>
                                <tr>
                                    <th>ID64</th>
                                    <th>Time (μs) / Real Time</th>
                                    <th>Event</th>
                                </tr>
                            </thead>
                            <tbody id="${nodeId}_event_data">
                                <tr><td colspan="3" style="text-align: center; color: #95a5a6; padding: 25px;">No events yet...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-content" id="${nodeId}_escan">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <button class="btn-node btn-escan" id="${nodeId}_escan_btn" disabled>Start Energy Scan</button>
                    </div>
                    <div class="section-header escan">
                        <span>Energy Scan Results (Ch11-Ch26)</span>
                        <span style="font-size: 12px; color: #7f8c8d;">Scroll to see all channels</span>
                    </div>
                    <div class="table-container" id="${nodeId}_escan_container" style="display: none;">
                        <table class="escan-table">
                            <thead>
                                <tr>
                                    <th>Channel</th>
                                    <th>Energy (dBm)</th>
                                </tr>
                            </thead>
                            <tbody id="${nodeId}_escan_data"></tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-content" id="${nodeId}_packets">
                    <div class="section-header packets">Data Packets (Length > 0)</div>
                    <div class="packet-info">
                        <span>Latest packets shown first</span>
                        <span class="packet-count" id="${nodeId}_packet_count">0</span>
                        <span>Click on any packet to view detailed analysis</span>
                    </div>
                    <div class="table-container">
                        <table class="packet-table">
                            <thead>
                                <tr>
                                    <th>ID64</th>
                                    <th>Time (μs) / Real Time</th>
                                    <th>RSSI</th>
                                    <th>LQI</th>
                                    <th>Channel</th>
                                    <th>Length</th>
                                    <th>Event</th>
                                    <th>Packet Type</th>
                                    <th>Payload</th>
                                </tr>
                            </thead>
                            <tbody id="${nodeId}_packet_data">
                                <tr><td colspan="9" style="text-align: center; color: #95a5a6; padding: 25px;">No data packets yet...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="tab-content" id="${nodeId}_cli">
                <div class="cli-container">
                    <div class="cli-header">
                        <span>Command Line Interface</span>
                        <button class="btn-node btn-clear-cli" id="${nodeId}_clear_cli">Clear History</button>
                    </div>
                    <div class="cli-output" id="${nodeId}_cli_output">
                        <div class="cli-welcome">
                            <span class="cli-prompt">${nodeId}&gt;</span> Welcome to CLI interface
                        </div>
                        <div class="cli-info">
                            <span class="cli-prompt">info&gt;</span> Type commands and press Enter to send via UART
                        </div>
                    </div>
                    <div class="cli-input-container">
                        <span class="cli-prompt">${nodeId}&gt;</span>
                        <input type="text" class="cli-input" id="${nodeId}_cli_input" 
                            placeholder="Type command here..." autocomplete="off" spellcheck="false">
                        <button class="btn-node btn-send-cli" id="${nodeId}_send_cli" disabled>Send</button>
                    </div>
                </div>
            </div>
            </div>
    
        </div>`;
    }

    // Setup Node Events
    function setupNodeEvents(nodeId, deviceType) {
        const isCoordinator = deviceType === 'coordinator';
        
        $(`#${nodeId}_close_device`).off('click').on('click', function(e) {
            e.stopPropagation();
            closeDevice(nodeId);
        });
        
        $(`#${nodeId}_event_count`).off('change').on('change', function() {
            const newCount = parseInt($(this).val());
            eventDisplayCounts[nodeId] = newCount;
            if (nodeDataCache[nodeId] && nodeDataCache[nodeId].events) {
                updateEventsTable(nodeId, nodeDataCache[nodeId].events);
            }
            saveAppState();
        });
        
        $(`#${nodeId}_collapse`).off('click').on('click', function(e) {
            e.stopPropagation();
            toggleNodeCollapse(nodeId);
        });
        
        $(`#${nodeId}_header`).off('click').on('click', function() {
            toggleNodeCollapse(nodeId);
        });
        
        $(`.tab[data-node="${nodeId}"]`).off('click').on('click', function(e) {
            e.stopPropagation();
            const tab = $(this).data('tab');
            $(`.tab[data-node="${nodeId}"]`).removeClass('active');
            $(`#${nodeId} .tab-content`).removeClass('active');
            $(this).addClass('active');
            $(`#${nodeId}_${tab}`).addClass('active');
        });
        
        $(`#${nodeId}_toggle`).off('click').on('click', function(e) {
            e.stopPropagation();
            togglePort(nodeId);
        });
        
        $(`#${nodeId}_escan_btn`).off('click').on('click', function(e) {
            e.stopPropagation();
            startEScan(nodeId);
        });
        
        if (isCoordinator) {
            $(`#${nodeId}_reset`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'reset');
            });
            
            $(`#${nodeId}_create_network`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'create_network');
            });
            
            $(`#${nodeId}_open_network`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'open_network');
            });
            
            $(`#${nodeId}_toggle_led`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'toggle_led');
            });
        } else {
            $(`#${nodeId}_reset`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'reset');
            });
            
            $(`#${nodeId}_leave_network`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'leave_network');
            });
            
            $(`#${nodeId}_join_network`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'join_network');
            });
            
            $(`#${nodeId}_turn_on_led`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'turn_on_led');
            });
            
            $(`#${nodeId}_turn_off_led`).off('click').on('click', function(e) {
                e.stopPropagation();
                zigbeeAction(nodeId, 'turn_off_led');
            });
        }
        setupCLIEvents(nodeId);
    }

    function closeDevice(nodeId) {
        const isConnected = $(`#${nodeId}_status`).hasClass('connected');
        if (isConnected) {
            showMessage(nodeId, 'Please close the port first before removing device', 'error');
            return;
        }
        
        $.ajax({
            url: '/remove_device',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ node_id: nodeId }),
            success: function(response) {
                if (response.status === 'success') {
                    $(`#${nodeId}`).fadeOut(300, function() {
                        $(this).remove();
                        if (nodeDataCache[nodeId]) {
                            delete nodeDataCache[nodeId];
                        }
                        if (nodeStartTimes[nodeId]) {
                            delete nodeStartTimes[nodeId];
                        }
                        updateNodeCount();
                        saveAppState();
                    });
                    console.log(`Device ${nodeId} removed successfully`);
                } else {
                    showMessage(nodeId, response.message, 'error');
                }
            },
            error: function() {
                showMessage(nodeId, 'Error removing device', 'error');
            }
        });
    }

    function updateCloseDeviceButton(nodeId, isConnected) {
        const $closeBtn = $(`#${nodeId}_close_device`);
        if (isConnected) {
            $closeBtn.prop('disabled', true);
            $closeBtn.attr('title', 'Close port first before removing device');
        } else {
            $closeBtn.prop('disabled', false);
            $closeBtn.attr('title', 'Close Device');
        }
    }

    function toggleNodeCollapse(nodeId) {
        const $content = $(`#${nodeId}_content`);
        const $btn = $(`#${nodeId}_collapse`);
        
        if ($content.hasClass('collapsed')) {
            $content.removeClass('collapsed');
            $btn.text('−');
            $btn.attr('title', 'Collapse');
        } else {
            $content.addClass('collapsed');
            $btn.text('+');
            $btn.attr('title', 'Expand');
        }
        saveAppState();
    }

    function togglePort(nodeId) {
        const $btn = $(`#${nodeId}_toggle`);
        const $status = $(`#${nodeId}_status`);
        const port = $(`#${nodeId}_port`).val();
        const baudrate = $(`#${nodeId}_baudrate`).val();
        
        if (!port) {
            showMessage(nodeId, 'Please select a COM port', 'error');
            return;
        }
        
        if ($btn.text().trim() === 'Open Port') {
            $btn.prop('disabled', true).html('<span class="loading"></span> Opening...');
            
            $.ajax({
                url: '/open_port',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    node_id: nodeId,
                    port: port,
                    baudrate: parseInt(baudrate)
                }),
                timeout: 15000,
                success: function(response) {
                    if (response.status === 'success') {
                        $btn.text('Close Port').prop('disabled', false);
                        $status.addClass('connected');
                        $(`#${nodeId} .zigbee-controls button`).prop('disabled', false);
                        $(`#${nodeId}_escan_btn`).prop('disabled', false);
                        
                        updateCloseDeviceButton(nodeId, true);
                        activeNodes.add(nodeId);
                        $(`#${nodeId}_cli_input`).prop('disabled', false);
                        startPolling(nodeId);
                        showMessage(nodeId, response.message, 'success');
                        saveAppState();
                    } else {
                        showMessage(nodeId, response.message, 'error');
                        $btn.text('Open Port').prop('disabled', false);
                    }
                    updateNodeCount();
                },
                error: function(xhr, status, error) {
                    const errorMsg = xhr.responseJSON?.message || error || 'Server connection error';
                    showMessage(nodeId, errorMsg, 'error');
                    $btn.text('Open Port').prop('disabled', false);
                }
            });
        } else {
            $.ajax({
                url: '/close_port',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ node_id: nodeId }),
                success: function(response) {
                    $btn.text('Open Port');
                    $status.removeClass('connected');
                    $(`#${nodeId} .zigbee-controls button`).prop('disabled', true);
                    $(`#${nodeId}_escan_btn`).prop('disabled', true);
                    updateCloseDeviceButton(nodeId, false);
                    activeNodes.delete(nodeId);
                    $(`#${nodeId}_cli_input`).prop('disabled', true);
                    $(`#${nodeId}_send_cli`).prop('disabled', true);
                    stopPolling(nodeId);
                    stopEScan(nodeId);
                    showMessage(nodeId, 'Port closed', 'success');
                    updateNodeCount();
                    saveAppState();
                }
            });
        }
    }

    function zigbeeAction(nodeId, action) {
        $.ajax({
            url: '/zigbee_action',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                node_id: nodeId,
                action: action
            }),
            success: function(response) {
                if (response.status === 'success') {
                    let actionName = action.replace('_', ' ').toUpperCase();
                    showMessage(nodeId, `${actionName} successful`, 'success');
                    if (nodeId.includes('coordinator') && response.led_status !== undefined) {
                        updateLedStatus(nodeId, response.led_status);
                    }
                } else {
                    showMessage(nodeId, response.message, 'error');
                }
            }
        });
    }

    function startEScan(nodeId) {
        const $btn = $(`#${nodeId}_escan_btn`);
        const $container = $(`#${nodeId}_escan_container`);
        
        $.ajax({
            url: `/start_escan/${nodeId}`,
            type: 'POST',
            success: function(response) {
                if (response.status === 'success') {
                    $btn.prop('disabled', true).html('<span class="loading"></span> Scanning...');
                    $container.show();
                    $(`#${nodeId}_escan_data`).empty();
                    escanIntervals[nodeId] = setInterval(() => {
                        updateEScanData(nodeId);
                    }, 1000);
                    showMessage(nodeId, 'Energy scan started', 'success');
                }
            }
        });
    }

    function stopEScan(nodeId) {
        if (escanIntervals[nodeId]) {
            clearInterval(escanIntervals[nodeId]);
            delete escanIntervals[nodeId];
        }
        $(`#${nodeId}_escan_btn`).prop('disabled', false).html('Start Energy Scan');
    }

    function updateEScanData(nodeId) {
        $.get(`/get_escan_data/${nodeId}`, function(response) {
            if (response.status === 'success') {
                const data = JSON.parse(response.data);
                saveNodeData(nodeId, 'escan', data);
                updateEScanTable(nodeId, data);
                
                let allChannelsScanned = true;
                for (let i = 11; i <= 26; i++) {
                    const chKey = `Ch${i}`;
                    if (data[chKey] === undefined || data[chKey] === 'inf') {
                        allChannelsScanned = false;
                    }
                }

                if (allChannelsScanned) {
                    stopEScan(nodeId);
                    showMessage(nodeId, 'Energy scan completed (CH11-CH26)', 'success');
                }
            }
        });
    }

    function updateEScanTable(nodeId, data) {
        const tbody = $(`#${nodeId}_escan_data`);
        tbody.empty();
        
        for (let i = 11; i <= 26; i++) {
            const chKey = `Ch${i}`;
            const energy = data[chKey] !== undefined && data[chKey] !== 'inf' 
                ? `${data[chKey]} dBm` 
                : 'Scanning...';
            tbody.append(`<tr><td><strong>CH${i}</strong></td><td>${energy}</td></tr>`);
        }
    }

    function startPolling(nodeId) {
        if (pollingIntervals[nodeId]) {
            clearInterval(pollingIntervals[nodeId]);
        }
        
        pollingIntervals[nodeId] = setInterval(() => {
            $.get(`/get_all_packages/${nodeId}`, function(data) {
                updatePacketsAndEvents(nodeId, data);
            });
            
            $.get(`/get_led_state/${nodeId}`, function(data) {
                if (data.status === 'success') {
                    updateLedStatus(nodeId, data.led_state);
                }
            });
        }, 1000);
    }

    function stopPolling(nodeId) {
        if (pollingIntervals[nodeId]) {
            clearInterval(pollingIntervals[nodeId]);
            delete pollingIntervals[nodeId];
        }
    }

    function updateLedStatus(nodeId, status) {
        const $indicator = $(`#${nodeId}_led_indicator`);
        const $text = $(`#${nodeId}_led_text`);
        
        $indicator.removeClass('on off');
        if (status === 'ON') {
            $indicator.addClass('on');
            $text.text('ON');
        } else if (status === 'OFF') {
            $indicator.addClass('off');
            $text.text('OFF');
        } else {
            $text.text('Unknown');
        }
    }

    function updatePacketsAndEvents(nodeId, packets) {
        const eventCount = eventDisplayCounts[nodeId] || 10;
        const dataPackets = packets.filter(p => parseInt(p.Length || 0) > 0).reverse();
        const eventPackets = packets.filter(p => parseInt(p.Length || 0) === 0).slice(-eventCount).reverse();
        
        saveNodeData(nodeId, 'packets', dataPackets);
        saveNodeData(nodeId, 'events', eventPackets);
        
        updatePacketsTable(nodeId, dataPackets);
        updateEventsTable(nodeId, eventPackets);
    }

    function updatePacketsTable(nodeId, dataPackets) {
        const packetTbody = $(`#${nodeId}_packet_data`);
        const packetCount = $(`#${nodeId}_packet_count`);
        
        packetCount.text(dataPackets.length);
        packetTbody.empty();
        
        if (dataPackets.length === 0) {
            packetTbody.append('<tr><td colspan="7" style="text-align: center; color: #95a5a6; padding: 25px;">No data packets yet...</td></tr>');
        } else {
            dataPackets.forEach((packet, index) => {
                const id64Cell = createID64Cell(packet);
                const timeCell = createTimeCell(packet, nodeId);
                const rssi = packet.RSSI && packet.RSSI !== 0 ? packet.RSSI : 'N/A';
                const lqi = packet.LQI && packet.LQI !== 0 ? packet.LQI : 'N/A';
                const channel = packet.Channel && packet.Channel !== 0 ? `Ch${packet.Channel}` : 'N/A';
                const length = packet.Length || '0';
                const event = packet.Event || 'N/A';
                const packetType = packet.TypePackage || 'Unknown';
                let payload = 'NULL';
                if (packet.Payload && packet.Payload.length > 0) {
                    payload = packet.Payload.map(b => {
                        if (typeof b === 'string') {
                            return b.toUpperCase();
                        } else {
                            const hex = b.toString(16).toUpperCase().padStart(2, '0');
                            return `0x${hex}`;
                        }
                    }).join(' ');
                }
                
                const eventBadge = event !== 'N/A' ? `<span class="event-badge">${event}</span>` : 'N/A';
                const packetTypeBadge = packetType !== 'Unknown' ? `<span class="event-badge">${packetType}</span>` : 'Unknown';
                const isRecent = index < 5 ? 'style="background: rgba(52, 152, 219, 0.1);"' : '';
                
                // Add click handler for packet detail
                const rowClass = 'packet-row-clickable';
                const rowData = `data-packet='${JSON.stringify(packet).replace(/'/g, "&apos;")}' data-node='${nodeId}'`;
                
                packetTbody.append(`<tr ${isRecent} class="${rowClass}" ${rowData} style="cursor: pointer;" title="Click to view detailed analysis">
                    ${id64Cell}
                    ${timeCell}
                    <td><strong>${rssi}</strong></td>
                    <td><strong>${lqi}</strong></td>
                    <td><strong>${channel}</strong></td>
                    <td>${length}</td>
                    <td>${eventBadge}</td>
                    <td>${packetTypeBadge}</td>
                    <td class="payload-cell">${payload}</td>
                </tr>`);
            });
            
            // Add click event for packet rows
            $('.packet-row-clickable').off('click').on('click', function() {
                try {
                    const packetJson = $(this).attr('data-packet').replace(/&apos;/g, "'");
                    const packet = JSON.parse(packetJson);
                    const nodeId = $(this).attr('data-node');
                    showPackageDetail(packet, nodeId);
                } catch (error) {
                    console.error('Error parsing packet data:', error);
                }
            });
        }
    }

    function updateEventsTable(nodeId, eventPackets) {
        const eventTbody = $(`#${nodeId}_event_data`);
        const eventCount = eventDisplayCounts[nodeId] || 10;
        
        $(`#${nodeId} .section-header.events span`).first().text(`Events (Length = ${eventPackets.length})`);
        
        eventTbody.empty();
        
        if (eventPackets.length === 0) {
            eventTbody.append('<tr><td colspan="3" style="text-align: center; color: #95a5a6; padding: 25px;">No events yet...</td></tr>');
        } else {
            const displayEvents = eventPackets.slice(0, eventCount);
            displayEvents.forEach(packet => {
                const id64Cell = createID64Cell(packet);
                const timeCell = createTimeCell(packet, nodeId);
                const event = packet.Event || 'N/A';
                const eventBadge = event !== 'N/A' ? `<span class="event-badge">${event}</span>` : 'N/A';
                
                eventTbody.append(`<tr>
                    ${id64Cell}
                    ${timeCell}
                    <td>${eventBadge}</td>
                </tr>`);
            });
        }
    }

    // Document Ready với cleanup
    $(document).ready(async function() {
        console.log('🚀 Application starting...');
        
        // Initialize clock
        setInterval(updateRealTimeClock, 1000);
        updateRealTimeClock();
        
        // Load saved state với cleanup
        console.log('📋 Loading application state...');
        const stateLoaded = await loadAppState();
        if (!stateLoaded) {
            console.log('ℹ️ No saved state found, starting fresh');
        }
        
        // Global controls
        $('#reloadPorts').off('click').on('click', function(e) {
            e.preventDefault();
            reloadPorts();
        });
        
        $('#addEndDevice').off('click').on('click', function(e) {
            e.preventDefault();
            createNode('end-device');
        });
        
        $('#addCoordinator').off('click').on('click', function(e) {
            e.preventDefault();
            createNode('coordinator');
        });
        
        $('#clearState').off('click').on('click', function(e) {
            e.preventDefault();
            if (confirm('Clear all saved nodes and data? This will remove all Events, Packets, and EScan data.')) {
                clearAppState();
                location.reload();
            }
        });
        
        // THÊM: Cleanup Server button
        $('#cleanupServer').off('click').on('click', async function(e) {
            e.preventDefault();
            if (confirm('Cleanup all nodes on server? This will close all connections.')) {
                $(this).prop('disabled', true).text('Cleaning...');
                try {
                    await cleanupServer();
                    alert('✅ Server cleanup completed successfully!');
                } catch (error) {
                    alert('❌ Server cleanup failed: ' + error.message);
                } finally {
                    $(this).prop('disabled', false).text('Cleanup Server');
                }
            }
        });
        
        $('#openBerTest').off('click').on('click', function(e) {
            e.preventDefault();
            window.open('/bertest_page', '_blank');
        });
        
        // Modal controls
        $('#closePackageModal').off('click').on('click', function() {
            $('#packageDetailModal').hide();
        });
        
        $('#packageDetailModal').off('click').on('click', function(e) {
            if (e.target === this) {
                $(this).hide();
            }
        });
        
        $('.protocol-header').off('click').on('click', function() {
            const toggle = $(this).data('toggle');
            const content = $(`#${toggle}Content`);
            const icon = $(this).find('.protocol-icon');
            
            if (content.is(':visible')) {
                content.hide();
                icon.text('▶');
            } else {
                content.show();
                icon.text('▼');
            }
        });
        
        // Initialize
        reloadPorts();
        setInterval(saveAppState, 30000);
        
        // Enhanced beforeunload với cleanup
        window.addEventListener('beforeunload', function(e) {
            saveAppState();
            // Không cleanup khi đóng trang để có thể reconnect
        });
        
        // Keyboard shortcuts
        $(document).keydown(function(e) {
            if (e.key === 'Escape' && $('#packageDetailModal').is(':visible')) {
                $('#packageDetailModal').hide();
            }
        });
        
        console.log('✅ Application initialized successfully');
    });
    // CLI Functions
    function setupCLIEvents(nodeId) {
        const $input = $(`#${nodeId}_cli_input`);
        const $sendBtn = $(`#${nodeId}_send_cli`);
        const $clearBtn = $(`#${nodeId}_clear_cli`);
        
        // Send button click
        $sendBtn.off('click').on('click', function(e) {
            e.stopPropagation();
            sendCLICommand(nodeId);
        });
        
        // Enter key press
        $input.off('keypress').on('keypress', function(e) {
            if (e.which === 13) { // Enter key
                e.preventDefault();
                sendCLICommand(nodeId);
            }
        });
        
        // Enable/disable send button based on input
        $input.off('input').on('input', function() {
            const hasText = $(this).val().trim().length > 0;
            $sendBtn.prop('disabled', !hasText);
        });
        
        // Clear history button
        $clearBtn.off('click').on('click', function(e) {
            e.stopPropagation();
            clearCLIHistory(nodeId);
        });
        
        // Focus input when tab is activated
        $(`.tab[data-tab="cli"][data-node="${nodeId}"]`).off('click').on('click', function(e) {
            e.stopPropagation();
            const tab = $(this).data('tab');
            $(`.tab[data-node="${nodeId}"]`).removeClass('active');
            $(`#${nodeId} .tab-content`).removeClass('active');
            $(this).addClass('active');
            $(`#${nodeId}_${tab}`).addClass('active');
            
            // Focus on CLI input when CLI tab is activated
            setTimeout(() => {
                $(`#${nodeId}_cli_input`).focus();
            }, 100);
        });
    }

    function sendCLICommand(nodeId) {
        const $input = $(`#${nodeId}_cli_input`);
        const $sendBtn = $(`#${nodeId}_send_cli`);
        const $output = $(`#${nodeId}_cli_output`);
        
        const command = $input.val().trim();
        if (!command) return;
        
        // Disable input and button during sending
        $input.prop('disabled', true);
        $sendBtn.prop('disabled', true).html('<span class="loading"></span> Sending...');
        
        // Add command to output immediately
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
        });
        
        $output.append(`
            <div class="cli-command">
                <span class="cli-timestamp">[${timestamp}]</span>
                <span class="cli-prompt">${nodeId}&gt;</span>
                <span class="cli-cmd-text">${command}</span>
            </div>
        `);
        
        // Send command to server
        $.ajax({
            url: '/send_cli_command',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                node_id: nodeId,
                command: command
            }),
            timeout: 5000,
            success: function(response) {
                if (response.status === 'success') {
                    // Add response to output
                    const responseLines = response.response.split('\n');
                    responseLines.forEach(line => {
                        if (line.trim()) {
                            $output.append(`
                                <div class="cli-response">
                                    <span class="cli-timestamp">[${response.timestamp}]</span>
                                    <span class="cli-response-text">${line}</span>
                                </div>
                            `);
                        }
                    });
                } else {
                    $output.append(`
                        <div class="cli-error">
                            <span class="cli-timestamp">[${timestamp}]</span>
                            <span class="cli-error-text">Error: ${response.message}</span>
                        </div>
                    `);
                }
            },
            error: function(xhr, status, error) {
                const errorMsg = xhr.responseJSON?.message || error || 'Connection error';
                $output.append(`
                    <div class="cli-error">
                        <span class="cli-timestamp">[${timestamp}]</span>
                        <span class="cli-error-text">Error: ${errorMsg}</span>
                    </div>
                `);
            },
            complete: function() {
                // Re-enable input and button
                $input.prop('disabled', false).val('').focus();
                $sendBtn.prop('disabled', false).text('Send');
                
                // Scroll to bottom
                $output.scrollTop($output[0].scrollHeight);
            }
        });
    }

    function clearCLIHistory(nodeId) {
        const $output = $(`#${nodeId}_cli_output`);
        $output.empty().append(`
            <div class="cli-welcome">
                <span class="cli-prompt">${nodeId}&gt;</span> CLI history cleared
            </div>
            <div class="cli-info">
                <span class="cli-prompt">info&gt;</span> Type commands and press Enter to send via UART
            </div>
        `);
        $(`#${nodeId}_cli_input`).focus();
    }


