/**
 * index.js - Centralizador de Novas Mecânicas
 * 
 * Este diretório (`src/new_mechanics/`) foi criado especificamente para isolar e documentar
 * as novas mecânicas de jogo de forma modular e independente, facilitando o porte direto
 * para o Godot 4.x / GDScript e permitindo que agentes ou desenvolvedores adicionem novas regras
 * sem ter que reler ou refatorar o motor inteiro a cada alteração.
 * 
 * Mecânicas Disponíveis:
 * 1. BarrelCrosshairAlignment - Mira dinâmica guiada pelo cano da arma (Wardogs / Tarkov style).
 * 2. TacticalInventorySystem - Tela de inventário tático com slots de gear e grid de mochila.
 * 3. AimAssistSystem - Assistência de mira magnética de alta performance (Friction Bubble, Rotational & ADS Snap).
 * 4. LocomotionSmoothingSystem - Sistema unificado de suavização contínua de animações e transições de locomoção (Idle/Walk/Sprint/ADS).
 */

export { BarrelCrosshairAlignment } from './BarrelCrosshairAlignment.js';
export { TacticalInventorySystem } from './TacticalInventorySystem.js';
export { AimAssistSystem } from './AimAssistSystem.js';
export { LocomotionSmoothingSystem } from './LocomotionSmoothingSystem.js';

