import logoSrc from "../../assets/logo.png";

export default function GlobalFooter() {
  return (
    <footer className="app-global-footer-sleek" role="contentinfo">
      <div className="footer-sleek-inner">
        <div className="footer-sleek-left">
          <div className="footer-logo-badge-mini">
            <img src={logoSrc} alt="Boli Logo" className="footer-logo-mini" />
          </div>
          <span className="footer-brand-tag">
            <strong>BOLI (बोली)</strong> · Mother Tongue-Based Multilingual Education Suite
          </span>
          <span className="footer-divider-dot" aria-hidden="true">•</span>
          <span className="footer-engine-tag">
            Transitional Bilingual Education Tool for Primary Schools
          </span>
        </div>

        <div className="footer-sleek-right">
          <span className="footer-boundary-pill">
            <span className="status-dot-active" />
            <span>Santali & Kurukh: Neural MT · Ho, Mundari & Sadri: Linguistic Transfer</span>
          </span>
          <span className="footer-copy">© 2026 BOLI</span>
        </div>
      </div>
    </footer>
  );
}
