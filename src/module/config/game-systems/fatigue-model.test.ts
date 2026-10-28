import { describe, expect, it } from 'vitest';
import { SystemConfigRegistry } from './index';

/**
 * Fatigue model (#114). Only War uses the flat model; the config's
 * `getFatigueModel()` must return it. Configs are pure to construct, so no
 * Foundry runtime is needed.
 */
describe('fatigue model (#114)', () => {
    it('Only War is the single registered system and uses the flat model', () => {
        expect(SystemConfigRegistry.getIds()).toEqual(['ow']);
        expect(SystemConfigRegistry.get('ow').getFatigueModel().model).toBe('flat');
    });

    it('every system returns a well-formed FatigueModelDef', () => {
        for (const cfg of SystemConfigRegistry.getAll()) {
            const def = cfg.getFatigueModel();
            expect(['halving', 'flat', 'condition']).toContain(def.model);
            expect(['tb', 'tb+wpb', 'none']).toContain(def.threshold);
            expect(def.fullRecoveryHours).toBeGreaterThan(0);
        }
    });

    it('Only War uses the TB threshold with no fatigue-death', () => {
        expect(SystemConfigRegistry.get('ow').getFatigueModel().threshold).toBe('tb');
        expect(SystemConfigRegistry.get('ow').getFatigueModel().deathAtDoubleThreshold).toBe(false);
    });
});
