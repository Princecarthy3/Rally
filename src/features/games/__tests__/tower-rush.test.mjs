import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Rally Tower Rush Layout & Physics Validation", () => {
  it("validates 5 distinct obstacle sections and summit target", () => {
    const SUMMIT_ALTITUDE = 70.0;
    const CHECKPOINTS = [
      { idx: 0, name: "Ground Base", y: 0.5 },
      { idx: 1, name: "Checkpoint 1", y: 14.2 },
      { idx: 2, name: "Checkpoint 2", y: 28.2 },
      { idx: 3, name: "Checkpoint 3", y: 44.2 },
      { idx: 4, name: "Checkpoint 4", y: 58.2 },
      { idx: 5, name: "The Summit", y: 70.2 },
    ];

    assert.equal(CHECKPOINTS.length, 6, "Must have Ground Base, 4 intermediate checkpoints, and The Summit");
    assert.equal(CHECKPOINTS[5].y >= SUMMIT_ALTITUDE, true, "Summit must be at or above summit altitude");

    // Check monotonic altitude increase
    for (let i = 1; i < CHECKPOINTS.length; i++) {
      assert.ok(
        CHECKPOINTS[i].y > CHECKPOINTS[i - 1].y,
        `Checkpoint ${i} (${CHECKPOINTS[i].y}m) must be strictly higher than checkpoint ${i - 1} (${CHECKPOINTS[i - 1].y}m)`
      );
    }
  });

  it("calculates moving platform positions smoothly with sinusoidal factor", () => {
    function getMovingPlatformPos(startPos, endPos, period, phaseOffset, elapsedSec) {
      const t = (elapsedSec / period + (phaseOffset || 0)) * Math.PI * 2;
      const factor = (Math.sin(t) + 1) / 2;
      return [
        startPos[0] + (endPos[0] - startPos[0]) * factor,
        startPos[1] + (endPos[1] - startPos[1]) * factor,
        startPos[2] + (endPos[2] - startPos[2]) * factor,
      ];
    }

    const start = [2.0, 30.0, 5.0];
    const end = [5.0, 31.0, 5.0];
    const period = 4.0;

    // At t = 0
    const posAt0 = getMovingPlatformPos(start, end, period, 0, 0);
    assert.equal(posAt0[0], (start[0] + end[0]) / 2);

    // At quarter period (sin = 1, factor = 1) -> at end position
    const posAtQuarter = getMovingPlatformPos(start, end, period, 0, 1.0);
    assert.ok(Math.abs(posAtQuarter[0] - end[0]) < 0.001);

    // At three-quarter period (sin = -1, factor = 0) -> at start position
    const posAtThreeQuarter = getMovingPlatformPos(start, end, period, 0, 3.0);
    assert.ok(Math.abs(posAtThreeQuarter[0] - start[0]) < 0.001);
  });

  it("generates correct starting radial positions for up to 8 players", () => {
    function getTowerStartingPositions(count) {
      const positions = [];
      const radius = 4.2;
      for (let i = 0; i < count; i++) {
        const angle = (i / Math.max(1, count)) * Math.PI * 2;
        positions.push([
          Math.cos(angle) * radius,
          1.2,
          Math.sin(angle) * radius,
        ]);
      }
      return positions;
    }

    const eightPlayers = getTowerStartingPositions(8);
    assert.equal(eightPlayers.length, 8);

    // Verify all players are at base Y = 1.2
    eightPlayers.forEach((pos) => {
      assert.equal(pos[1], 1.2);
      const distFromCenter = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]);
      assert.ok(Math.abs(distFromCenter - 4.2) < 0.001);
    });

    // Ensure players don't spawn on top of each other
    for (let i = 0; i < eightPlayers.length; i++) {
      for (let j = i + 1; j < eightPlayers.length; j++) {
        const dx = eightPlayers[i][0] - eightPlayers[j][0];
        const dz = eightPlayers[i][2] - eightPlayers[j][2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        assert.ok(dist > 1.5, `Players ${i} and ${j} must have sufficient starting gap`);
      }
    }
  });
});
