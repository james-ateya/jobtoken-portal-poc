import { LegalList, LegalPageLayout, LegalSection } from "../components/LegalPageLayout";

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" icon="privacy">
      <p className="text-zinc-400">
        This Privacy Policy &amp; Data Protection Clause describes how JobToken Portal collects,
        uses, and protects your personal information when you use our services at{" "}
        <a
          href="https://www.jobtoken.co.ke"
          className="text-emerald-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.jobtoken.co.ke
        </a>
        .
      </p>

      <LegalSection title="1. Information We Collect">
        <p>
          To provide our token-based recruitment and interactive prompt services, we collect the
          following personal information:
        </p>
        <LegalList
          items={[
            "Account Data: Your name, email address, and account login credentials.",
            "M-Pesa Transaction Data: Your mobile phone number, M-Pesa transaction codes, and transaction amounts when you purchase tokens or receive rewards via the Safaricom Lipa na M-Pesa Buy Goods API. We do not store your M-Pesa PIN or bank details.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. How We Use Your Data">
        <p>Your data is processed strictly for the following operational needs:</p>
        <LegalList
          items={[
            "Payment Validation: Verifying your token purchases via the Safaricom STK Push network to instantly credit your digital wallet.",
            "Reward Disbursal: Processing and sending cash rewards directly to your registered M-Pesa mobile number.",
            "Service Delivery: Facilitating your job applications to employers listed on www.jobtoken.co.ke.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Data Sharing and Third Parties">
        <p>
          We do not sell, rent, or trade your personal data. Your information is shared only with
          certified partners necessary to run our platform:
        </p>
        <LegalList
          items={[
            "Safaricom PLC: To process payments and disburse rewards securely.",
            "Employers: Your relevant profile details are shared only with employers when you explicitly consume a token to apply for a job.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Regulatory Compliance and Security">
        <p>
          In strict compliance with the <strong className="text-zinc-200">Kenya Data Protection Act, 2019</strong>,
          JobToken Portal implements robust technical and organizational security measures to prevent
          unauthorized data access, loss, or disclosure. Your data is stored securely and retained
          only as long as necessary to provide our services or comply with financial auditing
          regulations.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
