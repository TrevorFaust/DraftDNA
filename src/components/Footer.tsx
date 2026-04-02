import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OfficialRulesContent } from '@/components/OfficialRulesContent';
import { SITE_NAME, SEASON } from '@/constants/contest';

export const Footer = () => {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-border/50 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            <span className="font-medium">Disclaimer:</span> This website is an independent fan project and is not affiliated with, authorized, sponsored, or endorsed by the National Football League (NFL), the NFL Players Association (NFLPA), or any individual NFL member club. All player names, team names, and colors are used for descriptive and identification purposes only. All trademarks and copyrights belong to their respective owners.
          </p>
          <p className="text-xs text-muted-foreground text-center mt-3">
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              className="underline hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              Privacy Policy
            </button>
            {' · '}
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="underline hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              Official Pick Six Rules
            </button>
          </p>
        </div>
      </footer>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin text-sm text-muted-foreground space-y-4 flex-1 min-h-0">
            <p>Last Updated: February 26, 2026</p>
            <p>This Privacy Policy describes how Pick Six Challenge (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and protects your information when you participate in our contest.</p>
            <section>
              <h3 className="font-semibold text-foreground mb-1">1. Information We Collect</h3>
              <p><strong>Participant Data:</strong> When you enter, we collect your name, email address, and state of residence to manage your entry and verify eligibility.</p>
              <p className="mt-2"><strong>Winner Data:</strong> If you are a potential winner of a prize valued at $2,000 or more, we are legally required to collect your Social Security Number (via Form W-9) and a copy of your Government-Issued ID for tax reporting and age verification.</p>
              <p className="mt-2"><strong>Technical Data:</strong> We may collect IP addresses and browser information to prevent &quot;bot&quot; entries and enforce our &quot;One Entry Rule.&quot;</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">2. How We Use Your Information</h3>
              <p>We use your information strictly for:</p>
              <ul className="list-disc list-inside mt-2 space-y-0.5">
                <li>Administering the Pick Six Challenge.</li>
                <li>Verifying your identity and eligibility.</li>
                <li>Notifying winners and processing prize payouts.</li>
                <li>Complying with IRS tax reporting requirements.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">3. Data Sharing &amp; Third Parties</h3>
              <p><strong>No Selling of Data:</strong> We do not sell, rent, or trade your personal information to third-party marketers.</p>
              <p className="mt-2"><strong>Legal Compliance:</strong> We may share winner information with the IRS as required by federal law.</p>
              <p className="mt-2"><strong>Service Providers:</strong> We may use secure third-party tools (such as reCAPTCHA or email providers) to facilitate the contest. These providers are prohibited from using your data for any other purpose.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">4. Data Security</h3>
              <p>We implement industry-standard security measures to protect your information. Sensitive documents (like IDs or W-9s) are stored in encrypted environments and are only accessible by authorized personnel for the purpose of winner verification.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">5. Your Rights</h3>
              <p>You may request to have your account and data deleted at any time by contacting us at [Insert Your Support Email]. Note that deleting your data prior to the conclusion of the contest will result in the forfeiture of your entry.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground mb-1">6. Children&apos;s Privacy</h3>
              <p>The Pick Six Challenge is strictly for individuals aged 18 and older. We do not knowingly collect information from children under the age of 13.</p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Pick Six Challenge: Official Rules</DialogTitle>
          </DialogHeader>
          <OfficialRulesContent siteName={SITE_NAME} season={SEASON} />
        </DialogContent>
      </Dialog>
    </>
  );
};
