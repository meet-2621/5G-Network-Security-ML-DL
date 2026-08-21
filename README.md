# 5G Network Security using ML & DL

An AI-powered 5G network security system designed to detect and classify network attacks using **Machine Learning (ML), Deep Learning (DL), network traffic analysis, and an interactive web dashboard**.

## 📌 Overview

With the rapid growth of 5G networks, the volume and complexity of network traffic have increased significantly. This creates new security challenges and makes automated threat detection increasingly important.

This project develops a **5G Network Security and Intrusion Detection System** that analyzes network traffic, extracts relevant features, and uses Machine Learning and Deep Learning models to identify whether the traffic is normal or potentially malicious.

The system is designed as an end-to-end pipeline:

```text
Network Traffic
       ↓
Data Capture
       ↓
Feature Extraction
       ↓
Preprocessing
       ↓
ML / DL Models
       ↓
Attack Detection & Classification
       ↓
Backend API
       ↓
Interactive Web Dashboard
```

## 🎯 Objectives

* Analyze 5G/network traffic data.
* Extract meaningful network features.
* Preprocess data for ML/DL models.
* Detect malicious network activity.
* Classify different types of network attacks.
* Compare Machine Learning and Deep Learning approaches.
* Provide predictions through a backend API.
* Display security results through an interactive frontend.
* Support integration with live network traffic.

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │   Network Traffic   │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │    Data Capture     │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │ Feature Extraction  │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │   Preprocessing     │
                    └──────────┬──────────┘
                               ↓
                 ┌─────────────┴─────────────┐
                 ↓                           ↓
        ┌─────────────────┐         ┌─────────────────┐
        │  ML Model       │         │  DL Model       │
        └────────┬────────┘         └────────┬────────┘
                 └─────────────┬─────────────┘
                               ↓
                    ┌─────────────────────┐
                    │     Prediction      │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │     Backend API     │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │   Web Dashboard     │
                    └─────────────────────┘
```

## 📂 Project Structure

```text
5G-Network-Security-ML-DL/
│
├── backend/
│   └── ...
│
├── frontend/
│   └── ...
│
├── ml-pipeline/
│   ├── data/
│   │   └── ...
│   │
│   ├── models/
│   │   └── ...
│   │
│   ├── generate_dataset.py
│   ├── extract_features.py
│   ├── live_capture.sh
│   ├── predict.py
│   ├── train_model.py
│   └── requirements.txt
│
├── .gitignore
├── README.md
└── package.json
```

## 🤖 Machine Learning & Deep Learning

The ML/DL pipeline is responsible for transforming network traffic into predictions.

### Machine Learning Pipeline

```text
Raw Network Data
       ↓
Data Cleaning
       ↓
Feature Extraction
       ↓
Preprocessing
       ↓
Train/Test Split
       ↓
ML Model Training
       ↓
Evaluation
       ↓
Saved Model
```

### Deep Learning Pipeline

```text
Network Features
       ↓
Preprocessing
       ↓
Neural Network
       ↓
Training
       ↓
Validation
       ↓
Evaluation
       ↓
Saved DL Model
```

The project evaluates the models using metrics such as:

* Accuracy
* Precision
* Recall
* F1-score
* Confusion Matrix

The final ML and DL results will be added here after model training and evaluation are completed.

## 📡 Data & Feature Extraction

The `ml-pipeline` component handles the preparation of network data.

Important components include:

### `generate_dataset.py`

Responsible for generating/preparing the dataset used by the ML/DL pipeline.

### `extract_features.py`

Extracts relevant features from network traffic so that they can be provided to the trained models.

### `live_capture.sh`

Provides the foundation for capturing network traffic and connecting live traffic with the feature extraction and prediction pipeline.

## 🔮 Prediction Pipeline

The prediction process is designed as:

```text
Network Input
     ↓
Feature Extraction
     ↓
Preprocessing
     ↓
Trained ML/DL Model
     ↓
Prediction
     ↓
Attack Class / Normal Traffic
     ↓
Confidence Score
```

The main prediction logic is implemented through:

```text
ml-pipeline/predict.py
```

## 🖥️ Frontend

The frontend provides an interactive dashboard for monitoring and displaying network security predictions.

The dashboard is intended to display information such as:

* Network status
* Traffic information
* Detected attack type
* Prediction confidence
* Security alerts
* Model results

The frontend communicates with the backend API to obtain prediction results.

## ⚙️ Backend

The backend acts as the communication layer between the frontend and the ML/DL pipeline.

```text
Frontend
   ↓
Backend API
   ↓
ML/DL Prediction
   ↓
Backend Response
   ↓
Frontend
```

A typical prediction request will contain the required network features, while the response will contain the predicted class and associated confidence.

## 🛠️ Technologies Used

### Machine Learning / Deep Learning

* Python
* TensorFlow
* Keras
* NumPy
* Pandas
* Scikit-learn

### Network/Data Processing

* Python
* Network traffic data
* Feature extraction
* Live traffic capture

### Backend

* Backend API
* REST-based communication

### Frontend

* React / web-based frontend
* Interactive dashboard

### Development

* Git
* GitHub
* WSL / Linux environment

> The exact libraries and frameworks may be updated as development progresses.

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/5G-Network-Security-ML-DL.git
cd 5G-Network-Security-ML-DL
```

### 2. Create and activate the ML virtual environment

```bash
cd ml-pipeline

python3 -m venv venv

source venv/bin/activate
```

### 3. Install ML/DL dependencies

```bash
pip install -r requirements.txt
```

### 4. Verify TensorFlow

```bash
python -c "import tensorflow as tf; print(tf.__version__)"
```

### 5. Train the model

```bash
python train_model.py
```

### 6. Run prediction

```bash
python predict.py
```

> The exact commands may change as the backend and frontend integration is finalized.

## 📊 Model Evaluation

Model performance will be evaluated using:

| Metric           | Description                                      |
| ---------------- | ------------------------------------------------ |
| Accuracy         | Overall percentage of correct predictions        |
| Precision        | How many predicted attacks were actually attacks |
| Recall           | How many actual attacks were detected            |
| F1-score         | Balance between precision and recall             |
| Confusion Matrix | Detailed class-wise prediction performance       |

Final experimental results will be added after completing model training.

## 👥 Team Details

### Project Team

| S. No. | Team Member        | Role / Responsibility                              |
| -----: | ------------------ | -------------------------------------------------- |
|      1 | **Manmeet Kaur**   | Machine Learning & Deep Learning                   |
|      2 | **Aradhya Joshi**  | Frontend & Dashboard Development                   |
|      3 | **Adheesh Negi**   | Testing and System Integration                          |
|      4 | **Asheesh Mishra** | Dataset, Feature Extraction & Live Traffic Capture |
|      5 | **Jasmine**        | Testing, Documentation & System Integration        |

### 👨‍🏫 Project Mentor

**Surjit Singh**
Thapar Institute of Engineering & Technology
Email: **[surjit.singh@thapar.edu](mailto:surjit.singh@thapar.edu)**

---

## 🔄 Development Workflow

```text
Data / Live Traffic
        ↓
Feature Extraction
        ↓
ML + DL Development
        ↓
Prediction Module
        ↓
Backend Integration
        ↓
Frontend Integration
        ↓
Testing
        ↓
Final System
```

## 🔐 Security Use Case

The system is intended to demonstrate how AI-based techniques can be used for automated network security monitoring.

Potential applications include:

* Intrusion detection
* Malicious traffic detection
* Network anomaly detection
* Attack classification
* Security monitoring
* AI-assisted 5G network protection

## 📈 Future Scope

Possible future improvements include:

* Real-time 5G traffic monitoring.
* More network attack classes.
* Improved feature engineering.
* Real-time prediction.
* Model optimization for faster inference.
* Continuous model retraining.
* Advanced anomaly detection.
* Deployment on cloud infrastructure.
* Integration with security monitoring systems.
* Improved visualization and alerting.

## ⚠️ Disclaimer

This project is developed for **academic and research purposes**. It is intended to demonstrate AI-based network security and intrusion detection concepts and should not be considered a production-ready security solution.

## 📄 License

This project can be released under the **MIT License** or another license selected by the project team.

---

⭐ If you find this project useful, consider giving the repository a star.
