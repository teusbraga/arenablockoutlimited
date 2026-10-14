import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfaceEyedropper, surfaceEyedropper } from '../src/world/SurfaceEyedropper.js';
import { materialFactory } from '../src/world/MaterialFactory.js';

test('SurfaceEyedropper - Testes Unitários e Integrados do Conta-Gotas', async (t) => {
  await t.test('1. Projeção Triplanar em Buffer 2x2 (Top-Left Vermelho, Top-Right Verde, Bottom-Left Azul, Bottom-Right Amarelo)', () => {
    const eyedropper = new SurfaceEyedropper();
    const width = 2;
    const height = 2;
    // Buffer RGBA 2x2:
    // Pixel (0, 0) [Top-Left]: Vermelho (255, 0, 0)
    // Pixel (1, 0) [Top-Right]: Verde (0, 255, 0)
    // Pixel (0, 1) [Bottom-Left]: Azul (0, 0, 255)
    // Pixel (1, 1) [Bottom-Right]: Amarelo (255, 255, 0)
    const buffer = new Uint8ClampedArray([
      255, 0, 0, 255,     0, 255, 0, 255,
      0, 0, 255, 255,     255, 255, 0, 255
    ]);

    // Registra buffer para material 'test_quad' com uvScale = 1.0 (1 metro = 1 repetição)
    eyedropper.registerBuffer('test_quad', buffer, width, height, 1.0);

    // No WebGL:
    // Chão (normal Y = 1, ny > 0.6): u = x, v = z.
    // vFrac = 1.0 - (z % 1.0).
    // Para x = 0.25, z = 0.75:
    // uFrac = 0.25 -> px = floor(0.25 * 2) = 0
    // vFrac = 1.0 - 0.75 = 0.25 -> py = floor(0.25 * 2) = 0
    // Portanto deve ler Pixel (0, 0) -> Vermelho (0xff0000)
    const colRed = eyedropper.sampleColor({ x: 0.25, y: 0.0, z: 0.75 }, { x: 0, y: 1, z: 0 }, 'test_quad');
    assert.equal(colRed, 0xff0000, 'Deveria amostrar vermelho no quadrante Top-Left');

    // Para x = 0.75, z = 0.75:
    // px = 1, py = 0 -> Verde (0x00ff00)
    const colGreen = eyedropper.sampleColor({ x: 0.75, y: 0.0, z: 0.75 }, { x: 0, y: 1, z: 0 }, 'test_quad');
    assert.equal(colGreen, 0x00ff00, 'Deveria amostrar verde no quadrante Top-Right');

    // Para x = 0.25, z = 0.25:
    // vFrac = 1.0 - 0.25 = 0.75 -> py = 1, px = 0 -> Azul (0x0000ff)
    const colBlue = eyedropper.sampleColor({ x: 0.25, y: 0.0, z: 0.25 }, { x: 0, y: 1, z: 0 }, 'test_quad');
    assert.equal(colBlue, 0x0000ff, 'Deveria amostrar azul no quadrante Bottom-Left');

    // Para x = 0.75, z = 0.25:
    // px = 1, py = 1 -> Amarelo (0xffff00)
    const colYellow = eyedropper.sampleColor({ x: 0.75, y: 0.0, z: 0.25 }, { x: 0, y: 1, z: 0 }, 'test_quad');
    assert.equal(colYellow, 0xffff00, 'Deveria amostrar amarelo no quadrante Bottom-Right');
  });

  await t.test('2. Projeção Triplanar em Paredes (Normal X e Normal Z)', () => {
    const eyedropper = new SurfaceEyedropper();
    const buffer = new Uint8ClampedArray([
      255, 0, 0, 255,     0, 255, 0, 255,
      0, 0, 255, 255,     255, 255, 0, 255
    ]);
    eyedropper.registerBuffer('wall_test', buffer, 2, 2, 1.0);

    // Parede com normal X (nx > 0.6): u = z, v = y
    // z = 0.75, y = 0.75 -> px = 1, py = 0 -> Verde
    const colWallX = eyedropper.sampleColor({ x: 10.0, y: 0.75, z: 0.75 }, { x: 1, y: 0, z: 0 }, 'wall_test');
    assert.equal(colWallX, 0x00ff00, 'Parede no eixo X deve usar coordenadas Z e Y');

    // Parede com normal Z (nz > 0.6): u = x, v = y
    // x = 0.25, y = 0.25 -> px = 0, py = 1 -> Azul
    const colWallZ = eyedropper.sampleColor({ x: 0.25, y: 0.25, z: -5.0 }, { x: 0, y: 0, z: 1 }, 'wall_test');
    assert.equal(colWallZ, 0x0000ff, 'Parede no eixo Z deve usar coordenadas X e Y');
  });

  await t.test('3. Fallback Gracioso e Amostragem de Cores de Materiais Puros', () => {
    const eyedropper = new SurfaceEyedropper();

    // Material sem textura, apenas com cor pura
    eyedropper.registerMaterial('pure_color_wood', {
      color: { getHex: () => 0x6e4c32 }
    });

    const col = eyedropper.sampleColor({ x: 5, y: 2, z: -3 }, { x: 0, y: 1, z: 0 }, 'pure_color_wood');
    assert.equal(col, 0x6e4c32, 'Deve retornar a cor direta do material como fallback');

    // Material desconhecido deve retornar null
    const colUnknown = eyedropper.sampleColor({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 'non_existent_mat');
    assert.equal(colUnknown, null, 'Material inexistente deve retornar null para ativar fallback do json');
  });

  await t.test('4. Geração de Variação Orgânica de Brilho (Jittered Colors)', () => {
    const eyedropper = new SurfaceEyedropper();
    const baseColor = 0x808080; // Cinza médio (128, 128, 128)
    const palette = eyedropper.generateJitteredColors(baseColor, 4, 0.10);

    assert.equal(palette.length, 4, 'Deve gerar exatamente 4 cores');
    for (const c of palette) {
      assert(typeof c === 'number', 'Cada item deve ser um número hexadecimal');
      const r = (c >> 16) & 0xff;
      const g = (c >> 8) & 0xff;
      const b = c & 0xff;
      // Com base 128 e spread 0.10, os valores devem estar aproximadamente entre 100 e 150
      assert(r >= 100 && r <= 155, `R (${r}) deve estar próximo de 128`);
      assert(g >= 100 && g <= 155, `G (${g}) deve estar próximo de 128`);
      assert(b >= 100 && b <= 155, `B (${b}) deve estar próximo de 128`);
    }
  });

  await t.test('5. Integração com MaterialFactory e Singleton Global', () => {
    // Ao solicitar um material da fábrica, ele deve registrar o material no surfaceEyedropper
    const mat = materialFactory.get('wall_white');
    assert(mat, 'MaterialFactory deve retornar o material wall_white');

    const sampled = surfaceEyedropper.sampleColor({ x: 1, y: 1, z: 1 }, { x: 0, y: 1, z: 0 }, 'wall_white');
    // Deve retornar ou a cor amostrada da textura ou a cor base do material
    assert(sampled !== null, 'O singleton global surfaceEyedropper deve conseguir amostrar wall_white');
  });
});
