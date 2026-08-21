import pandas as pd
import numpy as np
import os
import random

def generate_data(num_samples=10000):
    print(f"Generating {num_samples} samples of synthetic 5G network traffic...")
    
    np.random.seed(42)
    random.seed(42)
    
    labels_dist = {'normal': 0.60, 'ddos': 0.15, 'port_scan': 0.10, 'dns_spoof': 0.08, 'mitm': 0.07}
    labels = np.random.choice(list(labels_dist.keys()), size=num_samples, p=list(labels_dist.values()))
    
    data = []
    
    for i, label in enumerate(labels):
        if i > 0 and i % 2000 == 0:
            print(f"Generated {i}/{num_samples} samples...")
            
        if label == 'normal':
            packet_size = np.random.randint(64, 1500)
            flow_duration = np.random.uniform(0.1, 10.0)
            packet_rate = np.random.uniform(10, 100)
            byte_rate = packet_rate * packet_size
            protocol_type = np.random.choice([0, 1, 2, 3], p=[0.7, 0.2, 0.05, 0.05])
            src_port = np.random.randint(1024, 65535)
            dst_port = np.random.choice([80, 443, 22, 53, 8080])
            flag_count = np.random.randint(0, 10)
            iat_mean = np.random.uniform(10, 100)
            payload_entropy = np.random.uniform(4.0, 7.5)
            
        elif label == 'ddos':
            packet_size = np.random.randint(64, 128)
            flow_duration = np.random.uniform(0.01, 2.0)
            packet_rate = np.random.uniform(1000, 10000)
            byte_rate = packet_rate * packet_size
            protocol_type = np.random.choice([0, 1, 2], p=[0.4, 0.4, 0.2])
            src_port = np.random.randint(1024, 65535)
            dst_port = 80
            flag_count = np.random.randint(5, 20)
            iat_mean = np.random.uniform(0.1, 5.0)
            payload_entropy = np.random.uniform(1.0, 3.0)
            
        elif label == 'port_scan':
            packet_size = 64
            flow_duration = np.random.uniform(0.1, 5.0)
            packet_rate = np.random.uniform(50, 500)
            byte_rate = packet_rate * packet_size
            protocol_type = 0
            src_port = np.random.randint(1024, 65535)
            dst_port = np.random.randint(1, 65535)
            flag_count = np.random.randint(2, 5)
            iat_mean = np.random.uniform(1, 10)
            payload_entropy = np.random.uniform(0.5, 2.0)
            
        elif label == 'dns_spoof':
            packet_size = np.random.randint(100, 300)
            flow_duration = np.random.uniform(0.05, 1.0)
            packet_rate = np.random.uniform(20, 100)
            byte_rate = packet_rate * packet_size
            protocol_type = 1
            src_port = 53
            dst_port = np.random.randint(1024, 65535)
            flag_count = 0
            iat_mean = np.random.uniform(5, 20)
            payload_entropy = np.random.uniform(5.0, 7.0)
            
        elif label == 'mitm':
            packet_size = np.random.randint(500, 1500)
            flow_duration = np.random.uniform(5.0, 20.0)
            packet_rate = np.random.uniform(30, 150)
            byte_rate = packet_rate * packet_size
            protocol_type = 0
            src_port = np.random.randint(1024, 65535)
            dst_port = np.random.choice([80, 443])
            flag_count = np.random.randint(5, 15)
            iat_mean = np.random.uniform(10, 50)
            payload_entropy = np.random.uniform(6.0, 8.0)
            
        data.append([
            packet_size, flow_duration, packet_rate, byte_rate, protocol_type, 
            src_port, dst_port, flag_count, iat_mean, payload_entropy, label
        ])
        
    columns = [
        'packet_size', 'flow_duration', 'packet_rate', 'byte_rate', 'protocol_type',
        'src_port', 'dst_port', 'flag_count', 'iat_mean', 'payload_entropy', 'label'
    ]
    
    df = pd.DataFrame(data, columns=columns)
    
    os.makedirs('data', exist_ok=True)
    out_path = os.path.join('data', '5g_traffic_dataset.csv')
    df.to_csv(out_path, index=False)
    print(f"Dataset generation complete. Saved to {out_path}")
    print(f"Class distribution:\n{df['label'].value_counts(normalize=True)}")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    generate_data()
