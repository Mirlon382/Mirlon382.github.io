---
title: 'Hand Volume Control'
description: 'Using Google MediaPipe for computer vision'
pubDate: 2026-05-09
heroImage: '../../assets/blog-placeholder-4.jpg'
---

# Using your fingers to control the volume
    To control the volume of your computer, you can basically use your finger to press the volume key. Nowadays you can also use your camera, a python script, ML and your fingers to do the same thing. It's overkill but cool. I stumbled upon some Instagram Reels and it got me inspired to try it out.

The idea is to map the volume slider to your hand and precisely to the space between your thumb and your index. You would be pinching your fingers to drop the volume to 0.

The sequence is :
- move your fingers
- camera records at low framerate
- ML model maps your fingers to coordinates in 2D space
- program computes the distance between the tip of your thumb and your index and maps it to the slider
- repeat at framerate

## Google MediaPipe

Open Source Computer Vision library with a Python SDK. It provides the model and maps it to a 2D space then it's Python scripting

## Need to try out 