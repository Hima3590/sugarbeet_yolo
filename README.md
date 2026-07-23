# Smart Weed Detection System 🌱

## Overview
A computer vision-based system for detecting sugar beet crops and weeds using YOLOv8. The system performs object detection on field images and provides zone-wise weed density analysis for targeted herbicide recommendations.

## Tech Stack
- YOLOv8 (Ultralytics)
- OpenCV
- FastAPI
- React.js

## Features
- Detects crops and weeds from uploaded images
- Generates bounding box visualizations
- Performs 4×4 grid-based field analysis
- Provides weed density insights

## Model Performance
- mAP@50: 93.5%
- Crop detection: 98%
- Weed detection: 88.5%

## Deployment
- Backend: FastAPI
- Frontend: React.js

## Project Structure
- Training notebook: YOLOv8 model training
- Backend: Image processing and inference API
- Frontend: User interface
