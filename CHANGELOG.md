# Changelog

## [Unreleased]

### Added
- BPM auto-detection using `web-audio-beat-detector` library
- Beat offset synchronization for accurate rhythm timing
- Score and combo persistence between levels
- Chase mode warning when all coins collected
- Audio visualizer on background
- Tutorial scene with rhythm training

### Changed
- Player drum sounds now play on music beat count (not move count)
- Reduced SFX volume to blend with music (0.2-0.3)
- Level 1 auto-starts after tutorial, levels 2+ show confirmation overlay
- Switched to track_2.mp3 as main music

### Removed
- Coin collection sound effect
- 6 unused music tracks:
  - SalmonLikeTheFish - Glacier.mp3
  - SalmonLikeTheFish - Zion.mp3
  - Squire Tuck - Heavy Heart.mp3
  - Shadowed Abyss-100bpm.mp3
  - Dungeon Pulse.mp3
  - music.ogg
- 15 unused SFX files (japanyoshithegamer 8-bit pack)

### Fixed
- Music playing twice after level transition (destroy sound on scene restart)
- Score/combo resetting between levels
- Start overlay error on level 1 (undefined check)
