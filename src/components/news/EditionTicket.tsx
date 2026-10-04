import type { SyntheticEvent } from "react";
import { Link } from "react-router-dom";

export type WeekTicket = {
  slug: string;
  href: string;
  issueDate: string;
  label: string;
  tabLabel: string;
  dateLabel: string;
  blurb: string | null;
  notes: string[];
  kicker: string;
};

function StubWeek({ tabLabel }: { tabLabel: string }) {
  const week = /^(Week|Preseason Week|Training Camp Week) (\d+)$/.exec(tabLabel);
  if (week) {
    const phase =
      week[1] === "Training Camp Week" ? "Camp" : week[1] === "Preseason Week" ? "Preseason" : "Week";
    return (
      <span className="ticket-stub-week">
        <small>{phase}</small>
        <strong>{week[2]}</strong>
      </span>
    );
  }
  return (
    <span className="ticket-stub-week">
      <small>Week</small>
      <strong className="is-range">{tabLabel}</strong>
    </span>
  );
}

export function EditionTicket({
  item,
  focusable = true,
}: {
  item: WeekTicket;
  focusable?: boolean;
}) {
  const startGlint = (event: SyntheticEvent<HTMLDivElement>) => {
    event.currentTarget.classList.add("is-glinting");
  };

  return (
    <div
      className="ticket"
      onPointerEnter={startGlint}
      onFocus={startGlint}
      onAnimationEnd={(event) => {
        if (event.animationName === "ticket-glint-once") {
          event.currentTarget.classList.remove("is-glinting");
        }
      }}
    >
      <span className="ticket-sheen" aria-hidden="true" />
      <span className="ticket-glint" aria-hidden="true" />
      <div className="ticket-main">
        <div className="ticket-meta">
          <span className="ticket-kicker">{item.kicker}</span>
          <time dateTime={item.issueDate}>{item.dateLabel}</time>
        </div>
        <h3 className="ticket-title">{item.label}</h3>
        {item.blurb ? <p className="ticket-hook">{item.blurb}</p> : null}
        {item.notes.length > 0 ? (
          <p className="ticket-notes">
            <span className="ticket-notes-label">In this week</span>
            {item.notes.map((note) => (
              <span key={note} className="ticket-note">
                {note}
              </span>
            ))}
          </p>
        ) : null}
        <div className="ticket-actions">
          <Link
            to={item.href}
            className="ticket-read"
            tabIndex={focusable ? 0 : -1}
            draggable={false}
          >
            Read {item.label}
          </Link>
        </div>
      </div>
      <div className="ticket-stub" aria-hidden="true">
        <span className="ticket-stub-admit">Admit one</span>
        <StubWeek tabLabel={item.tabLabel} />
        <span className="ticket-barcode" />
      </div>
    </div>
  );
}
