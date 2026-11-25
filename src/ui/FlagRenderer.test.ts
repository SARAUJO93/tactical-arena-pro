import { describe, expect, it } from 'vitest';
import { WORLD_ROSTER } from '../core/GameState';
import { renderTeamFlagHtml } from './FlagRenderer';

describe('renderTeamFlagHtml', () => {
  it('renders local SVG flags for every country in the world roster', () => {
    for (const team of WORLD_ROSTER) {
      const html = renderTeamFlagHtml(team.key, team.flag);
      expect(html).toContain('<svg class="team-flag-svg team-flag-inline"');
      expect(html).not.toContain('team-flag-fallback');
    }
  });

  it('keeps escaped emoji fallbacks for non-country rosters', () => {
    expect(renderTeamFlagHtml('MEX-CDMX', '🏙️')).toContain('team-flag-fallback team-flag-inline');
    expect(renderTeamFlagHtml('CUSTOM', '<img src=x>')).toContain('&lt;img src=x&gt;');
  });
});
