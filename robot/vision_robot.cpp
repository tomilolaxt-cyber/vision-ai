/*
 * ============================================================
 *  VISION - Real-Life Robot Version
 *  vision_robot.cpp
 * ============================================================
 *
 *  This file controls the physical robot body of Vision.
 *  Designed for Arduino / Raspberry Pi + servo motors,
 *  speaker, microphone, and camera module.
 *
 *  Hardware assumed:
 *    - Raspberry Pi 4 (or Arduino Mega for simpler builds)
 *    - 2x Servo motors (head pan + tilt)
 *    - 1x Speaker (via I2S or USB audio)
 *    - 1x Microphone (USB or I2S)
 *    - 1x Camera (Pi Camera or USB webcam)
 *    - LED ring (NeoPixel or similar) for the "eye"
 *    - Optional: servo arms, wheels
 *
 *  Compile (Linux/Pi):
 *    g++ -o vision_robot vision_robot.cpp -lwiringPi -lpthread
 *
 *  Compile (Arduino):
 *    Use Arduino IDE, include Servo.h and Wire.h
 * ============================================================
 */

#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <cmath>
#include <vector>
#include <functional>

// ── Platform detection ────────────────────────────────────────
#ifdef RASPBERRY_PI
  #include <wiringPi.h>
  #include <wiringPiI2C.h>
  #define PLATFORM "Raspberry Pi"
#elif defined(ARDUINO)
  #include <Arduino.h>
  #include <Servo.h>
  #define PLATFORM "Arduino"
#else
  // Simulation mode — runs on any PC for testing
  #define SIMULATION_MODE
  #define PLATFORM "Simulation"
#endif

// ============================================================
//  PIN DEFINITIONS
// ============================================================
namespace Pins {
  constexpr int HEAD_PAN_SERVO  = 18;   // GPIO 18 (PWM)
  constexpr int HEAD_TILT_SERVO = 19;   // GPIO 19 (PWM)
  constexpr int LED_RING_DATA   = 21;   // GPIO 21 (NeoPixel data)
  constexpr int SPEAKER_PIN     = 13;   // I2S / PWM audio
  constexpr int MIC_PIN         = 12;   // I2S mic input
  constexpr int STATUS_LED      = 26;   // Simple status LED
  constexpr int BUTTON_WAKE     = 16;   // Physical wake button
}

// ============================================================
//  CONSTANTS
// ============================================================
namespace Config {
  constexpr int   SERVO_CENTER     = 90;    // degrees
  constexpr int   SERVO_MIN        = 0;
  constexpr int   SERVO_MAX        = 180;
  constexpr int   HEAD_PAN_RANGE   = 60;    // ±60° from center
  constexpr int   HEAD_TILT_RANGE  = 30;    // ±30° from center
  constexpr float SMOOTH_FACTOR    = 0.15f; // servo smoothing
  constexpr int   LED_COUNT        = 24;    // NeoPixel ring LEDs
  constexpr int   LOOP_DELAY_MS    = 20;    // main loop delay
}

// ============================================================
//  COLOR STRUCT
// ============================================================
struct Color {
  uint8_t r, g, b;
  Color(uint8_t r=0, uint8_t g=0, uint8_t b=0) : r(r), g(g), b(b) {}

  static Color Blue()   { return {0,   180, 255}; }
  static Color Green()  { return {0,   255, 100}; }
  static Color Purple() { return {140, 0,   255}; }
  static Color Orange() { return {255, 140, 0  }; }
  static Color Red()    { return {255, 30,  0  }; }
  static Color Off()    { return {0,   0,   0  }; }
  static Color White()  { return {255, 255, 255}; }
};

// ============================================================
//  ROBOT STATE
// ============================================================
enum class RobotState {
  IDLE,
  LISTENING,
  THINKING,
  SPEAKING,
  SLEEPING,
  ALERT
};

// ============================================================
//  SERVO CONTROLLER
// ============================================================
class ServoController {
public:
  float currentPan  = Config::SERVO_CENTER;
  float currentTilt = Config::SERVO_CENTER;
  float targetPan   = Config::SERVO_CENTER;
  float targetTilt  = Config::SERVO_CENTER;

  void setTarget(float pan, float tilt) {
    targetPan  = std::max((float)(Config::SERVO_CENTER - Config::HEAD_PAN_RANGE),
                 std::min((float)(Config::SERVO_CENTER + Config::HEAD_PAN_RANGE), pan));
    targetTilt = std::max((float)(Config::SERVO_CENTER - Config::HEAD_TILT_RANGE),
                 std::min((float)(Config::SERVO_CENTER + Config::HEAD_TILT_RANGE), tilt));
  }

  // Call every loop tick — smoothly moves toward target
  void update() {
    currentPan  += (targetPan  - currentPan)  * Config::SMOOTH_FACTOR;
    currentTilt += (targetTilt - currentTilt) * Config::SMOOTH_FACTOR;
    writeServos();
  }

  void center() {
    setTarget(Config::SERVO_CENTER, Config::SERVO_CENTER);
  }

  void nod() {
    // Nod animation: tilt down then back up
    setTarget(currentPan, Config::SERVO_CENTER + 20);
    std::this_thread::sleep_for(std::chrono::milliseconds(300));
    setTarget(currentPan, Config::SERVO_CENTER);
  }

  void shake() {
    // Head shake: pan left-right
    setTarget(Config::SERVO_CENTER - 25, currentTilt);
    std::this_thread::sleep_for(std::chrono::milliseconds(250));
    setTarget(Config::SERVO_CENTER + 25, currentTilt);
    std::this_thread::sleep_for(std::chrono::milliseconds(250));
    setTarget(Config::SERVO_CENTER, currentTilt);
  }

private:
  void writeServos() {
#ifdef RASPBERRY_PI
    // wiringPi PWM write
    pwmWrite(Pins::HEAD_PAN_SERVO,  angleToPWM(currentPan));
    pwmWrite(Pins::HEAD_TILT_SERVO, angleToPWM(currentTilt));
#elif defined(ARDUINO)
    panServo.write((int)currentPan);
    tiltServo.write((int)currentTilt);
#else
    // Simulation: just print occasionally
    static int tick = 0;
    if (++tick % 50 == 0) {
      std::cout << "[Servo] Pan=" << (int)currentPan
                << "° Tilt=" << (int)currentTilt << "°\n";
    }
#endif
  }

  int angleToPWM(float angle) {
    // Map 0-180° to PWM range 50-250 (1ms-2ms pulse at 50Hz)
    return (int)(50 + (angle / 180.0f) * 200);
  }

#ifdef ARDUINO
  Servo panServo;
  Servo tiltServo;
#endif
};

// ============================================================
//  LED RING CONTROLLER
// ============================================================
class LEDRing {
public:
  void setAll(Color c) {
    for (int i = 0; i < Config::LED_COUNT; i++) setPixel(i, c);
    show();
  }

  void breathe(Color c, int steps = 30) {
    // Fade in
    for (int i = 0; i <= steps; i++) {
      float t = (float)i / steps;
      Color fc(c.r * t, c.g * t, c.b * t);
      setAll(fc);
      std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }
    // Fade out
    for (int i = steps; i >= 0; i--) {
      float t = (float)i / steps;
      Color fc(c.r * t, c.g * t, c.b * t);
      setAll(fc);
      std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }
  }

  void spin(Color c, int rounds = 2) {
    for (int r = 0; r < rounds * Config::LED_COUNT; r++) {
      setAll(Color::Off());
      setPixel(r % Config::LED_COUNT, c);
      show();
      std::this_thread::sleep_for(std::chrono::milliseconds(30));
    }
    setAll(Color::Off());
  }

  void pulse(Color c) {
    // Quick single pulse
    setAll(c);
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    setAll(Color::Off());
  }

  // Listening animation: rotating arc
  void listeningAnim(Color c, int tick) {
    setAll(Color::Off());
    int arc = 8;
    for (int i = 0; i < arc; i++) {
      int idx = (tick + i) % Config::LED_COUNT;
      float brightness = (float)(i + 1) / arc;
      setPixel(idx, Color(c.r * brightness, c.g * brightness, c.b * brightness));
    }
    show();
  }

  // Speaking animation: wave
  void speakingAnim(Color c, int tick) {
    for (int i = 0; i < Config::LED_COUNT; i++) {
      float wave = (std::sin((i + tick) * 0.4f) + 1.0f) / 2.0f;
      setPixel(i, Color(c.r * wave, c.g * wave, c.b * wave));
    }
    show();
  }

private:
  void setPixel(int idx, Color c) {
#ifdef RASPBERRY_PI
    // NeoPixel via rpi_ws281x library call would go here
    (void)idx; (void)c;
#elif defined(ARDUINO)
    // strip.setPixelColor(idx, strip.Color(c.r, c.g, c.b));
    (void)idx; (void)c;
#else
    // Simulation: no-op (too noisy to print every pixel)
    (void)idx; (void)c;
#endif
  }

  void show() {
#ifdef RASPBERRY_PI
    // ws2811_render(&ledstring);
#elif defined(ARDUINO)
    // strip.show();
#endif
  }
};
4
// ============================================================
//  AUDIO MANAGER
// ============================================================
class AudioManager {
public:
  bool isListening = false;
  float micLevel   = 0.0f;  // 0.0 - 1.0

  void startListening() {
    isListening = true;
    std::cout << "[Audio] Microphone active — listening...\n";
    // In real implementation: open ALSA/PortAudio stream
  }

  void stopListening() {
    isListening = false;
    std::cout << "[Audio] Microphone stopped.\n";
  }

  // Returns captured audio as base64 or raw PCM
  std::string captureAudio(int durationMs) {
    std::cout << "[Audio] Capturing " << durationMs << "ms of audio...\n";
    std::this_thread::sleep_for(std::chrono::milliseconds(durationMs));
    // Real: read from ALSA buffer, encode to base64, send to Whisper API
    return "audio_data_placeholder";
  }

  void speak(const std::string& text) {
    std::cout << "[Vision says] " << text << "\n";
    // Real: call TTS (espeak, pyttsx3, or OpenAI TTS) and play via speaker
    // Example: system("espeak '" + text + "'");
  }

  void updateMicLevel() {
    // Real: read RMS from audio buffer
    micLevel = 0.0f;
  }
};

// ============================================================
//  VISION ROBOT  (main class)
// ============================================================
class VisionRobot {
public:
  RobotState    state   = RobotState::IDLE;
  ServoController servo;
  LEDRing       leds;
  AudioManager  audio;
  bool          running = true;
  int           animTick = 0;

  void init() {
    std::cout << "╔══════════════════════════════════════╗\n";
    std::cout << "║   VISION Robot  |  " << PLATFORM << "          ║\n";
    std::cout << "╚══════════════════════════════════════╝\n";

#ifdef RASPBERRY_PI
    wiringPiSetupGpio();
    pinMode(Pins::STATUS_LED, OUTPUT);
    pinMode(Pins::BUTTON_WAKE, INPUT_PULLUP);
    std::cout << "[Init] GPIO configured.\n";
#elif defined(SIMULATION_MODE)
    std::cout << "[Init] Running in SIMULATION mode.\n";
#endif

    servo.center();
    leds.breathe(Color::Blue(), 20);
    std::cout << "[Init] Vision robot ready.\n";
    setState(RobotState::IDLE);
  }

  void setState(RobotState newState) {
    state = newState;
    switch (state) {
      case RobotState::IDLE:
        std::cout << "[State] IDLE\n";
        leds.setAll(Color(0, 40, 80));  // dim blue
        break;
      case RobotState::LISTENING:
        std::cout << "[State] LISTENING\n";
        audio.startListening();
        break;
      case RobotState::THINKING:
        std::cout << "[State] THINKING\n";
        leds.spin(Color::Orange(), 1);
        break;
      case RobotState::SPEAKING:
        std::cout << "[State] SPEAKING\n";
        break;
      case RobotState::SLEEPING:
        std::cout << "[State] SLEEPING\n";
        leds.setAll(Color::Off());
        servo.center();
        break;
      case RobotState::ALERT:
        std::cout << "[State] ALERT\n";
        leds.pulse(Color::Red());
        break;
    }
  }

  // ── Wake word detected ──────────────────────────────────────
  void onWakeWord() {
    std::cout << "[Wake] Wake word detected!\n";
    servo.nod();
    leds.breathe(Color::Blue(), 15);
    setState(RobotState::LISTENING);
  }

  // ── User finished speaking ──────────────────────────────────
  void onSpeechEnd(const std::string& transcript) {
    std::cout << "[Heard] " << transcript << "\n";
    audio.stopListening();
    setState(RobotState::THINKING);
    // Send transcript to AI backend (HTTP POST to Python server)
    std::string reply = queryAI(transcript);
    setState(RobotState::SPEAKING);
    audio.speak(reply);
    setState(RobotState::IDLE);
  }

  // ── Query AI backend ────────────────────────────────────────
  std::string queryAI(const std::string& text) {
    std::cout << "[AI] Querying Vision backend...\n";
    // Real: use libcurl to POST to http://localhost:5000/chat
    // curl_easy_setopt(curl, CURLOPT_URL, "http://localhost:5000/chat");
    // For now, return a placeholder
    return "I heard you say: " + text + ". Connect me to the Python backend for real AI responses.";
  }

  // ── Track face / object ─────────────────────────────────────
  void trackFace(float faceX, float faceY) {
    // faceX, faceY: normalized -1.0 to 1.0 (from camera center)
    float targetPan  = Config::SERVO_CENTER - (faceX * Config::HEAD_PAN_RANGE);
    float targetTilt = Config::SERVO_CENTER + (faceY * Config::HEAD_TILT_RANGE);
    servo.setTarget(targetPan, targetTilt);
  }

  // ── Main loop ───────────────────────────────────────────────
  void run() {
    std::cout << "[Vision] Main loop started. Press Ctrl+C to stop.\n\n";

    while (running) {
      animTick++;

      // Update servo positions (smooth movement)
      servo.update();

      // Update LED animations based on state
      switch (state) {
        case RobotState::LISTENING:
          leds.listeningAnim(Color::Green(), animTick);
          break;
        case RobotState::SPEAKING:
          leds.speakingAnim(Color::Purple(), animTick);
          break;
        case RobotState::THINKING:
          leds.listeningAnim(Color::Orange(), animTick * 2);
          break;
        default:
          break;
      }

      // Check physical wake button
#ifdef RASPBERRY_PI
      if (digitalRead(Pins::BUTTON_WAKE) == LOW) {
        onWakeWord();
      }
#endif

      // Simulation: demo cycle
#ifdef SIMULATION_MODE
      static int demoTick = 0;
      if (++demoTick == 100) {
        setState(RobotState::LISTENING);
      } else if (demoTick == 200) {
        onSpeechEnd("Hello Vision, what can you do?");
      } else if (demoTick == 350) {
        setState(RobotState::IDLE);
        demoTick = 0;
      }
#endif

      std::this_thread::sleep_for(std::chrono::milliseconds(Config::LOOP_DELAY_MS));
    }
  }

  void shutdown() {
    std::cout << "\n[Vision] Shutting down...\n";
    running = false;
    leds.breathe(Color::Red(), 10);
    leds.setAll(Color::Off());
    servo.center();
    std::cout << "[Vision] Goodbye.\n";
  }
};

// ============================================================
//  ENTRY POINT
// ============================================================
int main() {
  VisionRobot vision;
  vision.init();
  vision.run();
  vision.shutdown();
  return 0;
}

/*
 * ============================================================
 *  WIRING GUIDE
 * ============================================================
 *
 *  Raspberry Pi 4 connections:
 *
 *  Component          Pi GPIO Pin    Notes
 *  ─────────────────────────────────────────────────────────
 *  Head Pan Servo     GPIO 18        PWM0 — 5V power from rail
 *  Head Tilt Servo    GPIO 19        PWM1 — 5V power from rail
 *  NeoPixel Ring      GPIO 21        5V data, use level shifter
 *  Wake Button        GPIO 16        Pull-up, connect to GND
 *  Status LED         GPIO 26        220Ω resistor to GND
 *  USB Microphone     USB port       Any USB port
 *  USB Speaker        USB port       Or 3.5mm audio jack
 *  Pi Camera          CSI port       Ribbon cable
 *
 *  Power:
 *    - Servos: separate 5V 2A supply (don't power from Pi GPIO)
 *    - NeoPixel: separate 5V supply for >8 LEDs
 *    - Pi: official 5V 3A USB-C adapter
 *
 * ============================================================
 *  SOFTWARE DEPENDENCIES
 * ============================================================
 *
 *  sudo apt install wiringpi libcurl4-openssl-dev
 *  pip install openai flask flask-cors SpeechRecognition
 *
 *  For NeoPixel: https://github.com/jgarff/rpi_ws281x
 *  For face tracking: OpenCV (pip install opencv-python)
 *
 * ============================================================
 */
