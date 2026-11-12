import React, { useState } from "react";
import {
  notifyStore,
  seekAudio,
  selectTimelineItem,
  selectTrackAndGroup,
  storeState,
  toggleTrackLock,
  toggleTrackVisibility,
  useWorkbenchStore,
} from "../store/workbenchStore.ts";
import type { TrackId, TrackLockMap } from "../types.ts";

interface CollectionState {
  col_lyrics: boolean;
  col_structure: boolean;
  col_rhythm: boolean;
  col_candidates: boolean;
}

interface TrackExpandState {
  lyrics_main: boolean;
  structure_sections: boolean;
  rhythm_markers: boolean;
}

export function TimelineExplorer(): React.JSX.Element {
  const snap = useWorkbenchStore();
  const [collapsed, setCollapsed] = useState(false);
  const [colOpen, setColOpen] = useState<CollectionState>({
    col_lyrics: true,
    col_structure: true,
    col_rhythm: true,
    col_candidates: true,
  });
  const [trackOpen, setTrackOpen] = useState<TrackExpandState>({
    lyrics_main: true,
    structure_sections: false,
    rhythm_markers: false,
  });

  const lyricsLines = React.useMemo(
    () => snap.lyrics?.lines || [],
    [snap.lyrics?.lines],
  );
  const lyricsConfirmed = lyricsLines.filter(
    (l) => l.status === "confirmed",
  ).length;

  const allRegions = React.useMemo(
    () => snap.annotations?.regions || [],
    [snap.annotations?.regions],
  );
  const sectionRegions = React.useMemo(
    () => allRegions.filter((r) => r.category !== "representative_clip"),
    [allRegions],
  );
  const clipRegions = allRegions.filter(
    (r) => r.category === "representative_clip",
  );
  const sectionsConfirmed = sectionRegions.filter(
    (r) => r.status === "confirmed",
  ).length;

  const allMarkers = snap.annotations?.markers || [];
  const downbeatMarkers = allMarkers.filter((m) => m.category === "downbeat");
  const otherMarkers = allMarkers.filter((m) => m.category !== "downbeat");

  // Group lyrics by section_id for Level 3 sub-groups
  const lyricSectionGroups = React.useMemo(() => {
    const map = new Map<
      string,
      {
        sectionId: string;
        label: string;
        count: number;
        confirmed: number;
        firstId: string;
        lastId: string;
        startSec: number;
      }
    >();
    for (const l of lyricsLines) {
      const secId = l.section_id || "P001";
      const existing = map.get(secId);
      if (!existing) {
        const reg = sectionRegions.find((r) => r.id === secId);
        const shortLabel = reg
          ? reg.label.replace(/\s*\(.*\)$/, "")
          : secId;
        map.set(secId, {
          sectionId: secId,
          label: `${secId} · ${shortLabel}`,
          count: 1,
          confirmed: l.status === "confirmed" ? 1 : 0,
          firstId: l.id,
          lastId: l.id,
          startSec: l.start_sec,
        });
      } else {
        existing.count += 1;
        if (l.status === "confirmed") existing.confirmed += 1;
        existing.lastId = l.id;
      }
    }
    return Array.from(map.values());
  }, [lyricsLines, sectionRegions]);

  if (collapsed) {
    return (
      <aside className="wb-explorer is-collapsed">
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => setCollapsed(false)}
          title="展开时间轴资源管理器"
        >
          ▶
        </button>
        <div className="wb-explorer-vertical-title">TIMELINE EXPLORER</div>
      </aside>
    );
  }

  const renderTrackControls = (
    trackId: TrackId,
    lockKey?: keyof TrackLockMap,
  ) => {
    const visible = snap.trackVisibility[trackId];
    const locked = lockKey ? snap.trackLocks[lockKey] : true;
    return (
      <span
        className="wb-tree-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`wb-tree-icon-btn ${visible ? "is-on" : "is-off"}`}
          onClick={() => toggleTrackVisibility(trackId)}
          title={visible ? "在波形图上隐藏此轨道" : "在波形图上显示此轨道"}
        >
          {visible ? "👁️" : "🚫"}
        </button>
        {lockKey ? (
          <button
            type="button"
            className={`wb-tree-icon-btn ${locked ? "is-locked" : "is-unlocked"}`}
            onClick={() => toggleTrackLock(lockKey)}
            title={
              locked
                ? "已锁定边界（点击解锁以允许在波形上拖拽）"
                : "允许在波形上拖拽（点击锁定防误触）"
            }
          >
            {locked ? "🔒" : "🔓"}
          </button>
        ) : null}
      </span>
    );
  };

  return (
    <aside className="wb-explorer">
      <div className="wb-explorer-header">
        <span className="wb-explorer-title">🗂️ 时间轴资源管理器 (Explorer)</span>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => setCollapsed(true)}
          title="折叠侧边栏"
        >
          ◀
        </button>
      </div>

      <div className="wb-explorer-hint">
        点击轨道切换<strong>波形焦点层</strong>与右侧编辑器；非焦点轨道自动半透明防误触。
      </div>

      <div className="wb-tree-scroll">
        {/* Collection 1: Lyrics Alignment */}
        <div className="wb-tree-collection">
          <div
            className="wb-tree-col-header"
            onClick={() =>
              setColOpen((s) => ({ ...s, col_lyrics: !s.col_lyrics }))
            }
          >
            <span className="wb-tree-arrow">
              {colOpen.col_lyrics ? "▾" : "▸"}
            </span>
            <span className="wb-tree-col-name">01. 歌词对轴集合 (Lyrics)</span>
            <span className="wb-tree-badge">
              {lyricsConfirmed}/{lyricsLines.length}
            </span>
          </div>

          {colOpen.col_lyrics ? (
            <div className="wb-tree-children">
              {/* Track: Official Bilingual Lyrics */}
              <div
                className={`wb-tree-track ${snap.activeTrackId === "lyrics_main" && snap.selectedGroupId === null ? "is-active" : ""}`}
                onClick={() => selectTrackAndGroup("lyrics_main", null)}
              >
                <span
                  className="wb-tree-arrow"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTrackOpen((s) => ({
                      ...s,
                      lyrics_main: !s.lyrics_main,
                    }));
                  }}
                >
                  {trackOpen.lyrics_main ? "▾" : "▸"}
                </span>
                <span className="wb-swatch swatch-lyric" />
                <span className="wb-tree-label">
                  官方双语歌词轴 (L001–L063)
                </span>
                {renderTrackControls("lyrics_main", "lyrics_main")}
              </div>

              {/* Level 3: Sub-groups by Section */}
              {trackOpen.lyrics_main ? (
                <div className="wb-tree-subgroups">
                  <div
                    className={`wb-tree-subgroup ${snap.activeTrackId === "lyrics_main" && snap.selectedGroupId === null ? "is-selected" : ""}`}
                    onClick={() => selectTrackAndGroup("lyrics_main", null)}
                  >
                    <span>📋 全部歌词行 ({lyricsLines.length} 句)</span>
                    <span className="wb-tree-mini-count">
                      {lyricsConfirmed} 已确认
                    </span>
                  </div>
                  {lyricSectionGroups.map((grp) => (
                    <div
                      key={grp.sectionId}
                      className={`wb-tree-subgroup ${snap.activeTrackId === "lyrics_main" && snap.selectedGroupId === grp.sectionId ? "is-selected" : ""}`}
                      onClick={() => {
                        selectTrackAndGroup("lyrics_main", grp.sectionId);
                      }}
                      onDoubleClick={() => {
                        selectTrackAndGroup("lyrics_main", grp.sectionId);
                        seekAudio(grp.startSec);
                      }}
                      title="单击过滤此段落歌词；双击将播放头跳至该段落起点"
                    >
                      <span>
                        ♪ {grp.label} ({grp.firstId}–{grp.lastId})
                      </span>
                      <span
                        className={`wb-tree-mini-count ${grp.confirmed === grp.count ? "all-done" : ""}`}
                      >
                        {grp.confirmed}/{grp.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Collection 2: Music Structure */}
        <div className="wb-tree-collection">
          <div
            className="wb-tree-col-header"
            onClick={() =>
              setColOpen((s) => ({ ...s, col_structure: !s.col_structure }))
            }
          >
            <span className="wb-tree-arrow">
              {colOpen.col_structure ? "▾" : "▸"}
            </span>
            <span className="wb-tree-col-name">
              02. 音乐结构集合 (Structure)
            </span>
            <span className="wb-tree-badge">
              {sectionsConfirmed}/{sectionRegions.length}
            </span>
          </div>

          {colOpen.col_structure ? (
            <div className="wb-tree-children">
              {/* Track: Sections P001-P012 */}
              <div
                className={`wb-tree-track ${snap.activeTrackId === "structure_sections" ? "is-active" : ""}`}
                onClick={() => selectTrackAndGroup("structure_sections", null)}
              >
                <span
                  className="wb-tree-arrow"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTrackOpen((s) => ({
                      ...s,
                      structure_sections: !s.structure_sections,
                    }));
                  }}
                >
                  {trackOpen.structure_sections ? "▾" : "▸"}
                </span>
                <span className="wb-swatch swatch-section" />
                <span className="wb-tree-label">
                  曲式段落划分 (P001–P012)
                </span>
                {renderTrackControls(
                  "structure_sections",
                  "structure_sections",
                )}
              </div>

              {trackOpen.structure_sections ? (
                <div className="wb-tree-subgroups">
                  {sectionRegions.map((reg) => (
                    <div
                      key={reg.id}
                      className={`wb-tree-subgroup ${snap.selectedKind === "region" && snap.selectedId === reg.id ? "is-selected" : ""}`}
                      onClick={() => selectTimelineItem("region", reg.id, true)}
                    >
                      <span>{reg.label}</span>
                      <span className="wb-tree-mini-count">
                        {reg.start_sec.toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Track: Representative Clip */}
              <div
                className={`wb-tree-track ${snap.activeTrackId === "structure_clips" ? "is-active" : ""}`}
                onClick={() => selectTrackAndGroup("structure_clips", null)}
              >
                <span className="wb-tree-arrow">•</span>
                <span className="wb-swatch swatch-clip" />
                <span className="wb-tree-label">
                  代表性验证片段 ({clipRegions.length})
                </span>
                {renderTrackControls("structure_clips", "structure_clips")}
              </div>
            </div>
          ) : null}
        </div>

        {/* Collection 3: Rhythm & Accents */}
        <div className="wb-tree-collection">
          <div
            className="wb-tree-col-header"
            onClick={() =>
              setColOpen((s) => ({ ...s, col_rhythm: !s.col_rhythm }))
            }
          >
            <span className="wb-tree-arrow">
              {colOpen.col_rhythm ? "▾" : "▸"}
            </span>
            <span className="wb-tree-col-name">
              03. 节拍与重音集合 (Rhythm)
            </span>
            <span className="wb-tree-badge">{allMarkers.length}</span>
          </div>

          {colOpen.col_rhythm ? (
            <div className="wb-tree-children">
              <div
                className={`wb-tree-track ${snap.activeTrackId === "rhythm_downbeats" ? "is-active" : ""}`}
                onClick={() => selectTrackAndGroup("rhythm_downbeats", null)}
              >
                <span className="wb-tree-arrow">•</span>
                <span className="wb-swatch swatch-downbeat" />
                <span className="wb-tree-label">
                  小节第一拍 Downbeats ({downbeatMarkers.length})
                </span>
                {renderTrackControls("rhythm_downbeats", "rhythm_downbeats")}
              </div>

              <div
                className={`wb-tree-track ${snap.activeTrackId === "rhythm_markers" ? "is-active" : ""}`}
                onClick={() => selectTrackAndGroup("rhythm_markers", null)}
              >
                <span
                  className="wb-tree-arrow"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTrackOpen((s) => ({
                      ...s,
                      rhythm_markers: !s.rhythm_markers,
                    }));
                  }}
                >
                  {trackOpen.rhythm_markers ? "▾" : "▸"}
                </span>
                <span className="wb-swatch swatch-beat" />
                <span className="wb-tree-label">
                  拍点 / 重音 / 切镜点 ({otherMarkers.length})
                </span>
                {renderTrackControls("rhythm_markers", "rhythm_markers")}
              </div>

              {trackOpen.rhythm_markers ? (
                <div className="wb-tree-subgroups">
                  {[
                    { id: null, label: "全部非强拍标记" },
                    { id: "beat", label: "beat (普通拍点)" },
                    { id: "accent", label: "accent (重音)" },
                    { id: "vocal", label: "vocal (人声点)" },
                    { id: "cut", label: "cut (候选切镜点)" },
                  ].map((cat) => (
                    <div
                      key={cat.id || "all"}
                      className={`wb-tree-subgroup ${snap.activeTrackId === "rhythm_markers" && snap.selectedGroupId === cat.id ? "is-selected" : ""}`}
                      onClick={() =>
                        selectTrackAndGroup("rhythm_markers", cat.id)
                      }
                    >
                      <span>{cat.label}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Collection 4: Auto Candidates Reference */}
        <div className="wb-tree-collection">
          <div
            className="wb-tree-col-header"
            onClick={() =>
              setColOpen((s) => ({
                ...s,
                col_candidates: !s.col_candidates,
              }))
            }
          >
            <span className="wb-tree-arrow">
              {colOpen.col_candidates ? "▾" : "▸"}
            </span>
            <span className="wb-tree-col-name">
              04. 自动分析参考层 (Auto Ref)
            </span>
            <span className="wb-tree-badge">只读</span>
          </div>

          {colOpen.col_candidates ? (
            <div className="wb-tree-children">
              <div
                className="wb-tree-track"
                onClick={() => toggleTrackVisibility("cand_beats")}
              >
                <span className="wb-tree-arrow">•</span>
                <span className="wb-swatch swatch-cand-beat" />
                <span className="wb-tree-label">
                  候选拍点 Beats ({snap.analysis?.beats?.length || 0})
                </span>
                {renderTrackControls("cand_beats")}
              </div>

              <div
                className="wb-tree-track"
                onClick={() => toggleTrackVisibility("cand_onsets")}
              >
                <span className="wb-tree-arrow">•</span>
                <span className="wb-swatch swatch-cand-onset" />
                <span className="wb-tree-label">
                  候选起音 Onsets ({snap.analysis?.onsets?.length || 0})
                </span>
                {renderTrackControls("cand_onsets")}
              </div>

              {snap.trackVisibility.cand_onsets ? (
                <div className="wb-tree-slider-row">
                  <span>起音显示阈值: {snap.onsetThreshold.toFixed(1)}</span>
                  <input
                    type="range"
                    min={0.5}
                    max={8.0}
                    step={0.1}
                    value={snap.onsetThreshold}
                    onChange={(e) => {
                      storeState.onsetThreshold = Number(e.target.value);
                      notifyStore();
                    }}
                  />
                </div>
              ) : null}

              <div
                className="wb-tree-track"
                onClick={() => toggleTrackVisibility("cand_energy")}
              >
                <span className="wb-tree-arrow">•</span>
                <span className="wb-swatch swatch-cand-energy" />
                <span className="wb-tree-label">
                  RMS 能量包络 ({snap.analysis?.energyShifts?.length || 0})
                </span>
                {renderTrackControls("cand_energy")}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
