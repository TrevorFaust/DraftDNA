/** Official Pick Six Challenge rules content (read-only). Used in terms dialog and footer. */
type Props = { siteName: string; season: number };

export function OfficialRulesContent({ siteName, season }: Props) {
  return (
    <div className="overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin text-sm text-muted-foreground space-y-4 flex-1 min-h-0">
      <section>
        <h3 className="font-semibold text-foreground mb-1">1. NO PURCHASE NECESSARY</h3>
        <p>The Pick Six Challenge is a 100% free-to-play contest of skill. No purchase, payment, or entry fee of any kind is required to enter or win. A purchase will not improve your chances of winning.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">2. ELIGIBILITY &amp; VOID JURISDICTIONS</h3>
        <p>The Contest is open only to legal residents of the United States who are 18 years of age or older at the time of entry (19+ in Alabama and Nebraska; 21+ in Arizona, Massachusetts, and Virginia).</p>
        <p className="mt-2"><strong>VOID STATES:</strong> Due to state-specific registration, bonding, and licensing requirements for high-value prize pools, this contest is VOID and not open to residents of Arizona, Florida, Iowa, Louisiana, Montana, New York, Rhode Island, and Washington.</p>
        <p className="mt-2">Any entry originating from a Void State is ineligible for any prize and will be disqualified.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">3. ENTRY LIMITS &amp; CONDUCT</h3>
        <p><strong>One Entry Rule:</strong> There is a strict limit of one (1) entry per person, per position group (QB, RB, WR, TE, K, DEF).</p>
        <p className="mt-2"><strong>Multiple Accounts:</strong> Use of multiple email addresses, identities, or any automated &quot;bot&quot; system to submit entries is strictly prohibited. Any participant found using multiple accounts or automated methods will have all entries voided and will be banned from the platform.</p>
        <p className="mt-2">To participate, users must have a verified {siteName} account. Sponsor reserves the right to review account activity and IP logs. If a single individual is found to be operating multiple accounts to bypass entry limits, all associated accounts and entries will be permanently disqualified and banned from the platform.</p>
        <p className="mt-2">All entries must be received and recorded by the Sponsor&apos;s servers prior to 8:00 PM ET on Thursday, September 3rd, 2026. Sponsor&apos;s computer is the official time-keeping device for this Contest. Entries submitted after this deadline are void, regardless of any technical malfunctions or server delays.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">4. THE &quot;PERFECT PICK SIX&quot; JACKPOT</h3>
        <p><strong>The Goal:</strong> To win a Category Jackpot, an entrant must correctly predict the Top 6 fantasy point scorers in a specific position group in Exact Order (#1 through #6).</p>
        <p className="mt-2"><strong>Category Prize:</strong> Each category (QB, RB, WR, TE, K, DEF) carries a $5,000.00 jackpot.</p>
        <p className="mt-2"><strong>Total Prize Pool:</strong> The total aggregate value of all prizes offered in this promotion is $30,000.00.</p>
        <p className="mt-2"><strong>The Tie-Breaker System:</strong> In the event multiple entrants achieve a Perfect Pick Six in the same category, the winner will be determined by the following logic:</p>
        <p className="mt-2"><strong>Prediction Metric:</strong> The entrant whose prediction is closest to the actual official regular-season stat for the #1 ranked player/team in that category will be declared the winner.</p>
        <p className="mt-2"><strong>Target Stats:</strong> QB: Total Passing Yards | RB: Total Rushing Yards | WR/TE: Total Receiving Yards | K: Total Field Goals Made | DEF: Total Points Allowed.</p>
        <p className="mt-2"><strong>The &quot;Price is Right&quot; Equidistance Rule:</strong> If two or more predictions are equally distant from the actual stat (e.g., one entrant is 50 yards over and another is 50 yards under), the &quot;Price is Right&quot; Rule applies: The entrant who did not go over the actual stat will be declared the winner.</p>
        <p className="mt-2"><strong>The Split:</strong> In the extremely unlikely event that multiple entrants achieve a Perfect Pick Six and submit identical tie-breaker guesses, the $5,000.00 category prize will be split equally among those tied winners.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">5. SCORING &amp; SOURCE OF TRUTH</h3>
        <p><strong>Official Scoring:</strong> Rankings are determined by ESPN Fantasy Football Half-PPR (0.5 PPR) scoring for the {season} NFL Regular Season (Weeks 1–18).</p>
        <p className="mt-2"><strong>Substitution Clause:</strong> Sponsor reserves the right to substitute an alternative official statistics provider of equal repute (e.g., NFL.com or Yahoo Sports) if ESPN becomes unavailable or fails to provide the necessary data.</p>
        <p className="mt-2"><strong>Postponed or Canceled Games:</strong> Only games completed within the official NFL 18-week regular-season window will be counted. Any game canceled, or postponed to a date beyond the completion of the Week 18 Monday Night Football game, will not be included in scoring.</p>
        <p className="mt-2"><strong>Finality of Results:</strong> All rankings become Final and Locked 72 hours after the conclusion of the final game of Week 18. Subsequent stat corrections issued by the NFL or ESPN after this 72-hour window will not change the contest results.</p>
        <p className="mt-2"><strong>Ranking Tie-Breakers:</strong> If NFL players finish with identical fantasy points, their rank (#1–#6) is decided by:</p>
        <ul className="list-disc list-inside mt-2 space-y-0.5">
          <li><strong>All:</strong> Highest single-game point total.</li>
          <li><strong>QB/RB/WR/TE:</strong> Most Total Yards | <strong>K:</strong> Longest FG | <strong>DEF:</strong> Most Total Turnovers (INT + FR).</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">6. WINNER VERIFICATION &amp; PUBLICITY</h3>
        <p><strong>Mandatory Verification:</strong> All potential winners must respond within 72 hours and provide: (1) Signed Affidavit of Eligibility, (2) Valid Govt Photo ID, and (3) IRS Form W-9.</p>
        <p className="mt-2"><strong>Publicity Release:</strong> By accepting a prize, the winner grants the Sponsor a worldwide, royalty-free license to use their name, likeness, and city/state of residence for promotional purposes in any media (including social media) without further payment or consideration, except where prohibited by law.</p>
        <p className="mt-2"><strong>Disqualification:</strong> Residents of Void States, underage participants, or those violating the &quot;One Entry Rule&quot; (including group collusion) will be disqualified, and their prize will be forfeited.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">7. {season} TAX COMPLIANCE</h3>
        <p>In accordance with the {season} Internal Revenue Code, any prize of $2,000.00 or more is reportable to the IRS.</p>
        <p className="mt-2"><strong>1099-MISC:</strong> A Form 1099-MISC will be issued to the winner for the {season} tax year.</p>
        <p className="mt-2"><strong>Responsibility:</strong> All federal, state, and local taxes are the sole responsibility of the winner.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">8. DISPUTES &amp; ARBITRATION</h3>
        <p>Any dispute arising from this contest shall be resolved by individual, binding arbitration under the rules of the American Arbitration Association, and entrants waive the right to participate in a class-action lawsuit.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">9. RELEASE OF LIABILITY</h3>
        <p>By participating, entrants agree to release and hold harmless {siteName}, the NFL, its member clubs, the NFLPA, and ESPN from any and all liability. This contest is an independent fan promotion and is not sponsored or endorsed by the NFL or ESPN.</p>
      </section>
    </div>
  );
}
