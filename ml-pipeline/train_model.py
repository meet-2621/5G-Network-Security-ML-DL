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

# Deep Learning
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, Input


def train_and_evaluate():

    print("Starting model training pipeline...")

    os.makedirs('models', exist_ok=True)

    # ==================================================
    # 1. LOAD DATA
    # ==================================================

    data_path = os.path.join(
        'data',
        '5g_traffic_dataset.csv'
    )

    if not os.path.exists(data_path):

        print(
            f"Error: Data file {data_path} not found."
        )

        print(
            "Run generate_dataset.py first."
        )

        return

    print(
        f"Loading data from {data_path}"
    )

    df = pd.read_csv(data_path)

    print(
        f"Dataset shape: {df.shape}"
    )

    # Features and target
    X = df.drop(
        'label',
        axis=1
    )

    y = df['label']

    feature_cols = X.columns.tolist()

    # Save feature order
    with open(
        os.path.join(
            'models',
            'feature_columns.json'
        ),
        'w'
    ) as f:

        json.dump(
            feature_cols,
            f,
            indent=4
        )

    # ==================================================
    # 2. ENCODE LABELS
    # ==================================================

    print("\nPreprocessing data...")

    le = LabelEncoder()

    y_encoded = le.fit_transform(y)

    print(
        "Classes:",
        list(le.classes_)
    )

    # Save label encoder
    joblib.dump(
        le,
        os.path.join(
            'models',
            'label_encoder.pkl'
        )
    )

    # ==================================================
    # 3. TRAIN / TEST SPLIT
    # ==================================================

    X_train, X_test, y_train, y_test = train_test_split(

        X,
        y_encoded,

        test_size=0.2,

        random_state=42,

        stratify=y_encoded
    )

    print(
        f"Train set size: {X_train.shape[0]}"
    )

    print(
        f"Test set size: {X_test.shape[0]}"
    )

    # ==================================================
    # 4. FEATURE SCALING
    # ==================================================

    print("\nScaling features...")

    scaler = StandardScaler()

    # Fit ONLY on training data
    X_train_scaled = scaler.fit_transform(
        X_train
    )

    # Transform test data
    X_test_scaled = scaler.transform(
        X_test
    )

    # Save scaler
    joblib.dump(
        scaler,
        os.path.join(
            'models',
            'scaler.pkl'
        )
    )

    # ==================================================
    # 5. DEFINE MACHINE LEARNING MODELS
    # ==================================================

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

    # ==================================================
    # 6. TRAIN MACHINE LEARNING MODELS
    # ==================================================

    for name, model in models.items():

        print(
            f"\n{'=' * 60}"
        )

        print(
            f"Training {name}..."
        )

        print(
            f"{'=' * 60}"
        )

        # Train
        model.fit(
            X_train_scaled,
            y_train
        )

        print(
            f"Evaluating {name}..."
        )

        # Predict
        y_pred = model.predict(
            X_test_scaled
        )

        # ------------------------------------------------
        # Metrics
        # ------------------------------------------------

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

            'precision': float(
                weighted_precision
            ),

            'recall': float(
                weighted_recall
            ),

            'f1_score': float(
                weighted_f1
            ),

            'macro_f1': float(
                macro_f1
            )
        }

        # ------------------------------------------------
        # Classification report
        # ------------------------------------------------

        print(
            f"\n{name} Classification Report:"
        )

        print(
            classification_report(
                y_test,
                y_pred,
                target_names=le.classes_,
                zero_division=0
            )
        )

        # ------------------------------------------------
        # Confusion matrix
        # ------------------------------------------------

        cm = confusion_matrix(
            y_test,
            y_pred
        )

        plt.figure(
            figsize=(8, 6)
        )

        sns.heatmap(
            cm,
            annot=True,
            fmt='d',
            cmap='Blues',
            xticklabels=le.classes_,
            yticklabels=le.classes_
        )

        plt.title(
            f'{name} - Confusion Matrix'
        )

        plt.xlabel(
            'Predicted'
        )

        plt.ylabel(
            'Actual'
        )

        plt.tight_layout()

        confusion_filename = (
            name.replace(
                ' ',
                '_'
            ).lower()
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
            f"Saved confusion matrix: "
            f"models/{confusion_filename}"
        )

        # ------------------------------------------------
        # Save ML model
        # ------------------------------------------------

        model_filename = (
            name.replace(
                ' ',
                '_'
            ).lower()
            + '.pkl'
        )

        joblib.dump(
            model,
            os.path.join(
                'models',
                model_filename
            )
        )

        print(
            f"Saved model: "
            f"models/{model_filename}"
        )

    # ==================================================
    # 7. DEEP LEARNING MODEL
    # ==================================================

    print(
        f"\n{'=' * 60}"
    )

    print(
        "Building Deep Learning Neural Network..."
    )

    print(
        f"{'=' * 60}"
    )

    num_classes = len(
        le.classes_
    )

    input_features = X_train_scaled.shape[1]

    # --------------------------------------------------
    # Neural Network architecture
    # --------------------------------------------------

    dnn_model = Sequential([

        Input(
            shape=(input_features,)
        ),

        Dense(
            64,
            activation='relu'
        ),

        Dropout(
            0.30
        ),

        Dense(
            32,
            activation='relu'
        ),

        Dropout(
            0.20
        ),

        Dense(
            16,
            activation='relu'
        ),

        Dense(
            num_classes,
            activation='softmax'
        )
    ])

    # --------------------------------------------------
    # Compile
    # --------------------------------------------------

    dnn_model.compile(

        optimizer='adam',

        loss='sparse_categorical_crossentropy',

        metrics=['accuracy']
    )

    print(
        "\nDeep Learning Model Architecture:"
    )

    dnn_model.summary()

    # ==================================================
    # 8. TRAIN DNN
    # ==================================================

    print(
        "\nTraining Deep Learning model..."
    )

    history = dnn_model.fit(

        X_train_scaled,

        y_train,

        epochs=20,

        batch_size=32,

        validation_split=0.2,

        verbose=1
    )

    # ==================================================
    # 9. EVALUATE DNN
    # ==================================================

    print(
        "\nEvaluating Deep Learning model..."
    )

    dnn_probabilities = dnn_model.predict(

        X_test_scaled,

        verbose=0
    )

    dnn_pred = np.argmax(

        dnn_probabilities,

        axis=1
    )

    # --------------------------------------------------
    # DNN Metrics
    # --------------------------------------------------

    dnn_accuracy = accuracy_score(
        y_test,
        dnn_pred
    )

    dnn_precision = precision_score(
        y_test,
        dnn_pred,
        average='weighted',
        zero_division=0
    )

    dnn_recall = recall_score(
        y_test,
        dnn_pred,
        average='weighted',
        zero_division=0
    )

    dnn_f1 = f1_score(
        y_test,
        dnn_pred,
        average='weighted',
        zero_division=0
    )

    dnn_macro_f1 = f1_score(
        y_test,
        dnn_pred,
        average='macro',
        zero_division=0
    )

    metrics_dict['Deep Learning'] = {

        'accuracy': float(
            dnn_accuracy
        ),

        'precision': float(
            dnn_precision
        ),

        'recall': float(
            dnn_recall
        ),

        'f1_score': float(
            dnn_f1
        ),

        'macro_f1': float(
            dnn_macro_f1
        )
    }

    # --------------------------------------------------
    # DNN Classification Report
    # --------------------------------------------------

    print(
        "\nDeep Learning Classification Report:"
    )

    print(
        classification_report(
            y_test,
            dnn_pred,
            target_names=le.classes_,
            zero_division=0
        )
    )

    # ==================================================
    # 10. DNN CONFUSION MATRIX
    # ==================================================

    dnn_cm = confusion_matrix(

        y_test,

        dnn_pred
    )

    plt.figure(
        figsize=(8, 6)
    )

    sns.heatmap(

        dnn_cm,

        annot=True,

        fmt='d',

        cmap='Blues',

        xticklabels=le.classes_,

        yticklabels=le.classes_
    )

    plt.title(
        'Deep Learning - Confusion Matrix'
    )

    plt.xlabel(
        'Predicted'
    )

    plt.ylabel(
        'Actual'
    )

    plt.tight_layout()

    plt.savefig(
        os.path.join(
            'models',
            'deep_learning_confusion_matrix.png'
        )
    )

    plt.close()

    print(
        "Saved confusion matrix: "
        "models/deep_learning_confusion_matrix.png"
    )

    # ==================================================
    # 11. SAVE DNN MODEL
    # ==================================================

    dnn_model.save(
        os.path.join(
            'models',
            'deep_learning.keras'
        )
    )

    print(
        "Saved Deep Learning model: "
        "models/deep_learning.keras"
    )

    # ==================================================
    # 12. SAVE TRAINING HISTORY
    # ==================================================

    history_dict = {

        'accuracy': [
            float(x)
            for x in history.history['accuracy']
        ],

        'loss': [
            float(x)
            for x in history.history['loss']
        ],

        'val_accuracy': [
            float(x)
            for x in history.history['val_accuracy']
        ],

        'val_loss': [
            float(x)
            for x in history.history['val_loss']
        ]
    }

    with open(
        os.path.join(
            'models',
            'deep_learning_history.json'
        ),
        'w'
    ) as f:

        json.dump(
            history_dict,
            f,
            indent=4
        )

    print(
        "Saved training history: "
        "models/deep_learning_history.json"
    )

    # ==================================================
    # 13. SAVE ALL METRICS
    # ==================================================

    with open(
        os.path.join(
            'models',
            'metrics.json'
        ),
        'w'
    ) as f:

        json.dump(
            metrics_dict,
            f,
            indent=4
        )

    print(
        "\nSaved metrics to models/metrics.json"
    )

    # ==================================================
    # 14. MODEL COMPARISON
    # ==================================================

    print(
        "\n"
        + "=" * 75
    )

    print(
        "MODEL COMPARISON SUMMARY"
    )

    print(
        "=" * 75
    )

    print(
        f"{'Model':<20} | "
        f"{'Accuracy':<10} | "
        f"{'Precision':<10} | "
        f"{'Recall':<10} | "
        f"{'F1':<10} | "
        f"{'Macro F1':<10}"
    )

    print(
        "-" * 75
    )

    for name, metrics in metrics_dict.items():

        print(

            f"{name:<20} | "

            f"{metrics['accuracy']:.4f}     | "

            f"{metrics['precision']:.4f}     | "

            f"{metrics['recall']:.4f}     | "

            f"{metrics['f1_score']:.4f}     | "

            f"{metrics['macro_f1']:.4f}"
        )

    print(
        "-" * 75
    )

    # ==================================================
    # 15. FIND BEST MODEL
    # ==================================================

    best_model_name = max(

        metrics_dict,

        key=lambda name:
        metrics_dict[name]['f1_score']
    )

    print(
        f"\nBest model based on F1-score: "
        f"{best_model_name}"
    )

    print(
        f"Best F1-score: "
        f"{metrics_dict[best_model_name]['f1_score']:.4f}"
    )

    # ==================================================
    # 16. MODEL COMPARISON GRAPH
    # ==================================================

    print(
        "\nGenerating model comparison graph..."
    )

    plot_data = []

    for model_name, metrics in metrics_dict.items():

        for metric_name, value in metrics.items():

            plot_data.append({

                'Model': model_name,

                'Metric': metric_name.capitalize(),

                'Score': value
            })

    plot_df = pd.DataFrame(
        plot_data
    )

    plt.figure(
        figsize=(12, 7)
    )

    sns.barplot(

        data=plot_df,

        x='Metric',

        y='Score',

        hue='Model'
    )

    plt.title(
        'ML and Deep Learning Model Performance Comparison'
    )

    plt.ylim(
        0,
        1.05
    )

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
        "Saved comparison graph: "
        "models/model_comparison.png"
    )

    # ==================================================
    # 17. FINISHED
    # ==================================================

    print(
        "\n"
        + "=" * 75
    )

    print(
        "PIPELINE COMPLETED SUCCESSFULLY"
    )

    print(
        "=" * 75
    )


if __name__ == '__main__':

    script_dir = os.path.dirname(
        os.path.abspath(__file__)
    )

    os.chdir(
        script_dir
    )

    train_and_evaluate()
