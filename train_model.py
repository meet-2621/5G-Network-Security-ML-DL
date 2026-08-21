import pandas as pd
import numpy as np
import os
import json
import joblib
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from xgboost import XGBClassifier

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)


def train_and_evaluate():

    print("Starting model training pipeline...")

    os.makedirs('models', exist_ok=True)

    # --------------------------------------------------
    # 1. LOAD DATA
    # --------------------------------------------------

    data_path = os.path.join('data', '5g_traffic_dataset.csv')

    if not os.path.exists(data_path):
        print(f"Error: Data file {data_path} not found.")
        print("Run generate_dataset.py first.")
        return

    print(f"Loading data from {data_path}")

    df = pd.read_csv(data_path)

    # Features and target
    X = df.drop('label', axis=1)
    y = df['label']

    feature_cols = X.columns.tolist()

    # Save feature order
    with open(
        os.path.join('models', 'feature_columns.json'),
        'w'
    ) as f:
        json.dump(feature_cols, f)

    # --------------------------------------------------
    # 2. ENCODE LABELS
    # --------------------------------------------------

    print("Preprocessing data...")

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    # Save label encoder
    joblib.dump(
        le,
        os.path.join('models', 'label_encoder.pkl')
    )

    # --------------------------------------------------
    # 3. TRAIN / TEST SPLIT
    # --------------------------------------------------

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y_encoded,
        test_size=0.2,
        random_state=42,
        stratify=y_encoded
    )

    print(f"Train set size: {X_train.shape[0]}")
    print(f"Test set size: {X_test.shape[0]}")

    # --------------------------------------------------
    # 4. FEATURE SCALING
    # --------------------------------------------------

    scaler = StandardScaler()

    # Fit ONLY on training data
    X_train_scaled = scaler.fit_transform(X_train)

    # Transform test data using the same scaler
    X_test_scaled = scaler.transform(X_test)

    # Save scaler
    joblib.dump(
        scaler,
        os.path.join('models', 'scaler.pkl')
    )

    # --------------------------------------------------
    # 5. DEFINE MODELS
    # --------------------------------------------------

    models = {

        'Random Forest':
            RandomForestClassifier(
                n_estimators=100,
                random_state=42
            ),

        'XGBoost':
            XGBClassifier(
                n_estimators=100,
                random_state=42,
                eval_metric='mlogloss'
            ),

        'SVM':
            SVC(
                kernel='rbf',
                probability=True,
                random_state=42
            )
    }

    metrics_dict = {}

    # --------------------------------------------------
    # 6. TRAIN AND EVALUATE
    # --------------------------------------------------

    for name, model in models.items():

        print(f"\nTraining {name}...")

        model.fit(
            X_train_scaled,
            y_train
        )

        print(f"Evaluating {name}...")

        y_pred = model.predict(
            X_test_scaled
        )

        # Overall metrics
        acc = accuracy_score(
            y_test,
            y_pred
        )

        weighted_precision = precision_score(
            y_test,
            y_pred,
            average='weighted',
            zero_division=0
        )

        weighted_recall = recall_score(
            y_test,
            y_pred,
            average='weighted',
            zero_division=0
        )

        weighted_f1 = f1_score(
            y_test,
            y_pred,
            average='weighted',
            zero_division=0
        )

        macro_f1 = f1_score(
            y_test,
            y_pred,
            average='macro',
            zero_division=0
        )

        metrics_dict[name] = {

            'accuracy': float(acc),

            'precision': float(weighted_precision),

            'recall': float(weighted_recall),

            'f1_score': float(weighted_f1),

            'macro_f1': float(macro_f1)
        }

        # --------------------------------------------------
        # 7. CLASSIFICATION REPORT
        # --------------------------------------------------

        print(f"\n{name} Classification Report:")
        print(
            classification_report(
                y_test,
                y_pred,
                target_names=le.classes_,
                zero_division=0
            )
        )

        # --------------------------------------------------
        # 8. CONFUSION MATRIX
        # --------------------------------------------------

        cm = confusion_matrix(
            y_test,
            y_pred
        )

        plt.figure(figsize=(8, 6))

        sns.heatmap(
            cm,
            annot=True,
            fmt='d',
            cmap='Blues',
            xticklabels=le.classes_,
            yticklabels=le.classes_
        )

        plt.title(f'{name} - Confusion Matrix')
        plt.xlabel('Predicted')
        plt.ylabel('Actual')
        plt.tight_layout()

        confusion_filename = (
            name.replace(' ', '_').lower()
            + '_confusion_matrix.png'
        )

        plt.savefig(
            os.path.join(
                'models',
                confusion_filename
            )
        )

        plt.close()

        print(
            f"Saved confusion matrix to "
            f"models/{confusion_filename}"
        )

        # --------------------------------------------------
        # 9. SAVE MODEL
        # --------------------------------------------------

        model_filename = (
            name.replace(' ', '_').lower()
            + '.pkl'
        )

        joblib.dump(
            model,
            os.path.join(
                'models',
                model_filename
            )
        )

    # --------------------------------------------------
    # 10. SAVE METRICS
    # --------------------------------------------------

    with open(
        os.path.join('models', 'metrics.json'),
        'w'
    ) as f:

        json.dump(
            metrics_dict,
            f,
            indent=4
        )

    # --------------------------------------------------
    # 11. MODEL COMPARISON
    # --------------------------------------------------

    print("\nModel Comparison Summary:")
    print("-" * 75)

    print(
        f"{'Model':<15} | "
        f"{'Accuracy':<10} | "
        f"{'Precision':<10} | "
        f"{'Recall':<10} | "
        f"{'F1':<10} | "
        f"{'Macro F1':<10}"
    )

    print("-" * 75)

    for name, metrics in metrics_dict.items():

        print(
            f"{name:<15} | "
            f"{metrics['accuracy']:.4f}     | "
            f"{metrics['precision']:.4f}      | "
            f"{metrics['recall']:.4f}     | "
            f"{metrics['f1_score']:.4f}     | "
            f"{metrics['macro_f1']:.4f}"
        )

    print("-" * 75)

    # --------------------------------------------------
    # 12. COMPARISON GRAPH
    # --------------------------------------------------

    print("\nGenerating comparison plot...")

    plot_data = []

    for model_name, metrics in metrics_dict.items():

        for metric_name, value in metrics.items():

            plot_data.append({
                'Model': model_name,
                'Metric': metric_name.capitalize(),
                'Score': value
            })

    plot_df = pd.DataFrame(plot_data)

    plt.figure(figsize=(10, 6))

    sns.barplot(
        data=plot_df,
        x='Metric',
        y='Score',
        hue='Model'
    )

    plt.title('Model Performance Comparison')
    plt.ylim(0, 1.05)

    plt.legend(
        bbox_to_anchor=(1.05, 1),
        loc='upper left'
    )

    plt.tight_layout()

    plt.savefig(
        os.path.join(
            'models',
            'model_comparison.png'
        )
    )

    plt.close()

    print(
        "Saved plot to models/model_comparison.png"
    )

    print("\nPipeline completed successfully.")


if __name__ == '__main__':

    script_dir = os.path.dirname(
        os.path.abspath(__file__)
    )

    os.chdir(script_dir)

    train_and_evaluate()
