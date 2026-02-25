# Final High-Level Workflow (End-to-End)

Live Interactive Country Flags Battle System with Reactive Audio

------------------------------------------------------------------------

## 🧱 Architecture Overview

    YouTube Live Chat
            ↓
    Chat Ingestion Service (Bun)
            ↓
    Event Queue (Redis PubSub / NATS)
            ↓
    Game Engine Server (Authoritative Logic)
            ↓
    Realtime WebSocket State
            ↓
    Overlay Renderer (React + PixiJS + Tone.js)
            ↓
    OBS Browser Source
            ↓
    YouTube Live Output

------------------------------------------------------------------------

## ⚡ 1. Chat Ingestion Service

**Purpose** - Read realtime YouTube chat - Parse country commands -
Publish spawn events

**Recommended Stack** - Bun - Fastify - YouTube LiveChat API

**Flow**

    Viewer Message → Parser → Redis Publish (spawn_country)

------------------------------------------------------------------------

## 🚀 2. Event Queue Layer

**Tools** - Redis PubSub - NATS (for large scale)

**Channels**

    spawn_country
    collision_event
    sound_event

**Why** - Prevent lag from chat spikes - Allow horizontal scaling

------------------------------------------------------------------------

## 🎮 3. Game Engine Server

**Responsibilities** - Spawn flags - Physics collision - Score
tracking - Emit sound triggers

**Tech** - Colyseus.js - WebSocket Server - Bun

**Game Loop**

    updateWorld() → 60 ticks/sec

**Collision Event**

    emit SOUND_TRIGGER(note, velocity)

------------------------------------------------------------------------

## 🖥️ 4. Overlay Renderer (Visual + Audio)

**Stack** - React - PixiJS (Rendering) - Tone.js (Audio Engine)

**Connection**

    ws://game-engine/state

Overlay handles: - Rendering - Music playback - Beat sync

------------------------------------------------------------------------

## 🎵 Reactive Audio System

**Flow**

    Collision Event
          ↓
    Sound Mapper
          ↓
    Tone.js Synth
          ↓
    Beat Quantizer
          ↓
    OBS Audio Output

**Tone.js Concept** - BPM controlled via Transport - Notes scheduled on
beat grid

------------------------------------------------------------------------

## 🎼 Viral Music Sync Strategy

1.  Detect BPM of viral music
2.  Define musical scale
3.  Map country → pitch

Example:

    ID → A4
    US → C5
    JP → E5

Result: - Procedural music - Gameplay becomes musical performance

------------------------------------------------------------------------

## 📡 5. OBS Integration

OBS Sources:

    Browser Source → Overlay URL
    Desktop Audio → Tone.js Output
    Camera (Optional)

Important: - Only overlay produces audio - Backend remains silent

------------------------------------------------------------------------

## 📦 Monorepo Structure

    /apps
       /chat-service
       /game-engine
       /overlay-web
       /ai-agent (optional)

    /packages
       /shared-types
       /audio-mapper
       /game-logic

Tooling: - Turborepo - Docker - Redis

------------------------------------------------------------------------

## 🤖 Optional AI Layer

AI Agent Capabilities: - Sentiment detection - Dynamic BPM adjustment -
Boss spawn logic

Example:

    High chat activity → Increase BPM
    Massive battle → Add bass layer

------------------------------------------------------------------------

## 🔥 Final Realtime Flow

    Viewer types country
            ↓
    Chat Service publishes event
            ↓
    Game Engine spawns flag
            ↓
    Collision detected
            ↓
    SOUND_TRIGGER emitted
            ↓
    Overlay renders effect
            ↓
    Tone.js plays synced note
            ↓
    OBS streams to YouTube
