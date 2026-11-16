import React, { useEffect, useRef, useState } from "react";
import type { Comment } from "../types.ts";

interface ScriptNotesEditorProps {
  comments?: Comment[];
  disabled: boolean;
  onChange: (comments: Comment[]) => void;
}

export const ScriptNotesEditor: React.FC<ScriptNotesEditorProps> = ({
  comments,
  disabled,
  onChange,
}) => {
  const [newRole, setNewRole] = useState<Comment["role"]>("human");
  const inputs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusNext = useRef<number | null>(null);
  const entries = comments?.length ? comments : [{ role: newRole, text: "" }];

  useEffect(() => {
    if (focusNext.current !== null) {
      inputs.current[focusNext.current]?.focus();
      focusNext.current = null;
    }
  }, [comments]);

  const addEntry = () => {
    if (!comments?.length) {
      inputs.current[0]?.focus();
      return;
    }
    focusNext.current = comments.length;
    onChange([...comments, { role: newRole, text: "" }]);
  };

  return (
    <div className="wb-section script-notes">
      <div className="wb-section__header">
        <span className="wb-section__title">脚本与备注</span>
        <div className="script-notes__actions">
          <select className="select select--sm" aria-label="新增脚本与备注的作者角色"
            value={newRole} disabled={disabled}
            onChange={(e) => setNewRole(e.target.value as Comment["role"])}>
            <option value="human">人类</option>
            <option value="agent">Agent</option>
          </select>
          <button type="button" className="btn btn--ghost btn--sm"
            disabled={disabled} onClick={addEntry}>新增一条</button>
        </div>
      </div>
      <div className="comments-thread">
        {entries.map((entry, index) => (
          <div className="script-note" key={index}>
            <div className="script-note__header">
              <label className="wb-label" htmlFor={`script-note-${index}`}>
                {entry.role === "agent" ? "Agent" : "人类"} · {index + 1}
              </label>
              {Boolean(comments?.length) && (
                <button type="button" className="btn btn--ghost btn--xs"
                  disabled={disabled} aria-label={`删除第 ${index + 1} 条脚本与备注`}
                  onClick={() => onChange(entries.filter((_, i) => i !== index))}>删除</button>
              )}
            </div>
            <textarea id={`script-note-${index}`} className="textarea script-note__input"
              ref={(input) => { inputs.current[index] = input; }}
              rows={5} value={entry.text} disabled={disabled}
              placeholder="写下这段的画面脚本、角色动作、转场或听音备注…"
              onChange={(e) => onChange(entries.map((item, i) =>
                i === index ? { ...item, text: e.target.value } : item))}
            />
          </div>
        ))}
      </div>
      <p className="muted script-notes__hint">直接编辑，Enter 换行；保存工程时写入磁盘。</p>
    </div>
  );
};
