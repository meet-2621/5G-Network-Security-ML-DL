import sys
import os
import json
import math
from collections import Counter

try:
    from scapy.all import rdpcap, IP, TCP, UDP, ICMP
except ImportError:
    print(json.dumps({"error": "scapy not installed. Run: pip install scapy"}))
    sys.exit(1)

import pandas as pd


def calculate_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    byte_counts = Counter(data)
    total = len(data)
    entropy = 0.0
    for count in byte_counts.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


def extract_features_from_pcap(pcap_path: str) -> list[dict]:
    print(f"[Extractor] Reading {pcap_path}...", file=sys.stderr)
    packets = rdpcap(pcap_path)
    print(f"[Extractor] Loaded {len(packets)} packets", file=sys.stderr)

    flows: dict[tuple, dict] = {}

    for pkt in packets:
        if IP not in pkt:
            continue

        src_ip = pkt[IP].src
        dst_ip = pkt[IP].dst

        if TCP in pkt:
            proto = 0
            src_port = pkt[TCP].sport
            dst_port = pkt[TCP].dport
            flags = int(pkt[TCP].flags)
        elif UDP in pkt:
            proto = 1
            src_port = pkt[UDP].sport
            dst_port = pkt[UDP].dport
            flags = 0
        elif ICMP in pkt:
            proto = 2
            src_port = 0
            dst_port = 0
            flags = 0
        else:
            proto = 3
            src_port = 0
            dst_port = 0
            flags = 0

        flow_key = (src_ip, dst_ip, src_port, dst_port, proto)

        if flow_key not in flows:
            flows[flow_key] = {
                'timestamps': [],
                'sizes': [],
                'flags': [],
                'payloads': b'',
                'src_port': src_port,
                'dst_port': dst_port,
                'proto': proto
            }

        flows[flow_key]['timestamps'].append(float(pkt.time))
        flows[flow_key]['sizes'].append(len(pkt))
        flows[flow_key]['flags'].append(flags)
        if hasattr(pkt, 'load'):
            flows[flow_key]['payloads'] += bytes(pkt.load)

    print(f"[Extractor] Found {len(flows)} flows", file=sys.stderr)

    features_list = []

    for flow_key, fd in flows.items():
        timestamps = fd['timestamps']
        sizes = fd['sizes']

        packet_size = int(sum(sizes) / len(sizes))
        flow_duration = max(timestamps) - min(timestamps) if len(timestamps) > 1 else 0.001
        packet_rate = len(sizes) / max(flow_duration, 0.001)
        byte_rate = sum(sizes) / max(flow_duration, 0.001)
        flag_count = sum(1 for f in fd['flags'] if f > 0)

        if len(timestamps) > 1:
            iats = [timestamps[i + 1] - timestamps[i] for i in range(len(timestamps) - 1)]
            iat_mean = (sum(iats) / len(iats)) * 1000
        else:
            iat_mean = 0.0

        payload_entropy = calculate_entropy(fd['payloads'])

        features_list.append({
            'packet_size': packet_size,
            'flow_duration': round(flow_duration, 4),
            'packet_rate': round(packet_rate, 2),
            'byte_rate': round(byte_rate, 2),
            'protocol_type': fd['proto'],
            'src_port': fd['src_port'],
            'dst_port': fd['dst_port'],
            'flag_count': flag_count,
            'iat_mean': round(iat_mean, 4),
            'payload_entropy': round(payload_entropy, 4)
        })

    return features_list


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python extract_features.py <pcap_file> [--output csv|json]")
        sys.exit(1)

    pcap_path = sys.argv[1]

    if not os.path.exists(pcap_path):
        print(json.dumps({"error": f"File not found: {pcap_path}"}))
        sys.exit(1)

    output_format = 'json'
    if '--output' in sys.argv:
        idx = sys.argv.index('--output')
        if idx + 1 < len(sys.argv):
            output_format = sys.argv[idx + 1]

    features = extract_features_from_pcap(pcap_path)

    if output_format == 'csv':
        df = pd.DataFrame(features)
        output_path = pcap_path.replace('.pcap', '_features.csv')
        df.to_csv(output_path, index=False)
        print(f"[Extractor] Saved {len(features)} flows to {output_path}", file=sys.stderr)
    else:
        print(json.dumps(features, indent=2))
