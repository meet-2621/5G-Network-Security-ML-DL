const API_BASE = 'http://localhost:3000';

const API = {

    async getStats() {
        try {
            const res = await fetch(`${API_BASE}/api/stats`);
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || 'Unknown error');
            }

            return json;

        } catch (err) {
            console.error('[API] getStats failed:', err);

            return {
                success: false,
                counters: {
                    total: 0,
                    normal: 0,
                    ddos: 0,
                    port_scan: 0,
                    dns_spoof: 0,
                    mitm: 0
                },
                modelMetrics: {
                    accuracy: 0,
                    precision: 0,
                    recall: 0,
                    f1: 0
                },
                uptime: 0,
                trafficRate: 0
            };
        }
    },


    async getTraffic(limit = 50) {
        try {
            const res = await fetch(
                `${API_BASE}/api/traffic?limit=${limit}`
            );

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || 'Unknown error');
            }

            return json;

        } catch (err) {
            console.error('[API] getTraffic failed:', err);

            return {
                success: false,
                data: [],
                total: 0
            };
        }
    },


    async getNetwork() {
        try {
            const res = await fetch(`${API_BASE}/api/network`);

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || 'Unknown error');
            }

            return json;

        } catch (err) {
            console.error('[API] getNetwork failed:', err);

            return {
                success: false,
                components: [],
                connections: []
            };
        }
    },


    async predict(features) {
        try {
            const res = await fetch(`${API_BASE}/api/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(features)
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || 'Unknown error');
            }

            return json.result;

        } catch (err) {
            console.error('[API] predict failed:', err);

            return {
                prediction: 'unknown',
                confidence: 0,
                probabilities: {}
            };
        }
    },


    generateIP() {
        const subnets = [

            () =>
                `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,

            () =>
                `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,

            () =>
                `172.${16 + Math.floor(Math.random() * 16)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
        ];

        return subnets[
            Math.floor(Math.random() * subnets.length)
        ]();
    },


    protocolName(type) {
        const map = {
            0: 'TCP',
            1: 'UDP',
            2: 'ICMP',
            3: 'SCTP'
        };

        return map[type] || 'TCP';
    }
};
