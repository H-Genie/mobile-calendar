"use client";

type AppHeaderProps = {
  monthValue: string;
  amOnly: boolean;
  onGoToday: () => void;
  onToggleAm: () => void;
  onGoMonth: (month: string) => void;
};

export function AppHeader({
  monthValue,
  amOnly,
  onGoToday,
  onToggleAm,
  onGoMonth,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <img
        className="app-header-logo"
        src="/icon.png"
        alt="Genie Schedule"
        width={28}
        height={28}
      />
      <div className="app-header-actions">
        <button type="button" className="header-btn" onClick={onGoToday}>
          오늘
        </button>
        <button
          type="button"
          className={amOnly ? "header-btn is-active" : "header-btn"}
          aria-pressed={amOnly}
          onClick={onToggleAm}
        >
          am
        </button>
        <input
          className="month-input"
          type="month"
          aria-label="월 이동"
          value={monthValue}
          onChange={(event) => {
            if (event.target.value) onGoMonth(event.target.value);
          }}
        />
      </div>
    </header>
  );
}
