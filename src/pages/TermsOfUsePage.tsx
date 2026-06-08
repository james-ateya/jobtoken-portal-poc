import { LegalList, LegalPageLayout, LegalSection } from "../components/LegalPageLayout";

export function TermsOfUsePage() {
  return (
    <LegalPageLayout title="Terms of Use" lastUpdated="May 2026" icon="terms">
      <p className="text-zinc-400">
        Welcome to <strong className="text-zinc-200">JobToken Portal</strong> (accessible via{" "}
        <a
          href="https://www.jobtoken.co.ke"
          className="text-emerald-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.jobtoken.co.ke
        </a>
        ). By creating an account or accessing our services, you agree to be bound by these Terms
        of Use.
      </p>

      <LegalSection title="1. Definition of Services">
        <p>JobToken Portal is an online digital platform that provides two primary services:</p>
        <LegalList
          items={[
            "Digital Recruitment Access: Facilitating connections between job seekers and external employers by listing employment opportunities.",
            "Skill-Based Engagement Prompts: Hosting educational, professional, or informational evaluation prompts designed to test user knowledge or gather structured feedback.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Purchase and Use of Digital Tokens">
        <LegalList
          items={[
            "Utility Token Nature: Users must purchase digital tokens to interact with the platform's core features, including submitting job applications and participating in engagement prompts.",
            "Payment Processing: All token purchases are completed via the integrated Safaricom Lipa na M-PESA Buy Goods payment gateway.",
            "Finality of Purchases: Purchased tokens are non-refundable, non-transferable, and hold no cash value outside of the JobToken Portal ecosystem. Tokens do not constitute a monetary deposit.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Job Application Framework">
        <LegalList
          items={[
            "Platform Role: JobToken Portal acts strictly as an advertising venue. We do not guarantee employment, interviews, or responses from listed employers.",
            "Token Consumption: One or more tokens will be permanently consumed from the user's account wallet upon the submission of a job application.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Knowledge Prompts and Reward Mechanism">
        <LegalList
          items={[
            "Skill-Based Criteria: The interactive prompt questions hosted on the platform are strictly skill-based evaluation activities. Selection of winners is determined by accuracy, speed, or specific criteria explicitly detailed in each individual prompt description. Chance plays no part in the outcome.",
            "Reward Fulfillment: Users who meet the predefined criteria of a prompt will qualify for a specified reward. All rewards are subject to internal verification by JobToken Portal.",
            "Disbursement: Approved rewards will be processed and disbursed directly to the verified user's registered M-PESA phone number associated with the account.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. User Compliance and Prohibited Conduct">
        <LegalList
          items={[
            "Account Security: Users are responsible for maintaining the confidentiality of their login credentials.",
            "Fraud Prevention: Any attempt to manipulate the prompt questions using bots, scripts, automated tools, or multiple accounts will result in immediate account termination, forfeiture of tokens, and withholding of any rewards.",
          ]}
        />
      </LegalSection>
    </LegalPageLayout>
  );
}
