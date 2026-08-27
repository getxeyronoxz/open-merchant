import type { SectionName, WorkflowStep } from "./useWorkflowProgress";

interface WorkflowGuideProps {
  readonly steps: WorkflowStep[];
  readonly currentStep: WorkflowStep;
  readonly completedCount: number;
  readonly totalSteps: number;
  readonly isReportGenerated: boolean;
  readonly guideVisible: boolean;
  readonly onToggleGuide: () => void;
  readonly onNavigate: (section: SectionName) => void;
  /** First-run guidance: shown while no provider key is configured. */
  readonly showsAiTip?: boolean;
}

export function WorkflowGuide({
  steps,
  currentStep,
  completedCount,
  totalSteps,
  isReportGenerated,
  guideVisible,
  onToggleGuide,
  onNavigate,
  showsAiTip = false,
}: WorkflowGuideProps) {
  if (!guideVisible) {
    return (
      <div className="om-guide-bar">
        <button
          className="om-button om-button--ghost om-guide-bar__btn"
          onClick={onToggleGuide}
          type="button"
        >
          <span className="om-dot" />
          <span>
            Show Walkthrough Guide ({completedCount}/{totalSteps} complete)
          </span>
        </button>
        {showsAiTip ? <span className="om-guide-bar__tip">AI assistants are optional</span> : null}
      </div>
    );
  }

  const rawIndex = steps.findIndex((s) => s.id === currentStep.id);
  const currentStepIndex = rawIndex >= 0 ? rawIndex : 0;

  return (
    <aside className="om-card om-guide" aria-label="Workflow Walkthrough">
      <header className="om-guide__head">
        <div className="om-guide__title-group">
          <span className="om-eyebrow">Walkthrough Guide</span>
          <h2 className="om-guide__title">
            {isReportGenerated
              ? "Opportunity Report Generated"
              : `Step ${currentStepIndex + 1} of ${totalSteps}: ${currentStep.label}`}
          </h2>
        </div>
        <div className="om-guide__head-actions">
          <span className="om-badge om-badge--brass">
            {completedCount} of {totalSteps} complete
          </span>
          <button
            className="om-button om-button--ghost"
            onClick={onToggleGuide}
            title="Hide walkthrough guide"
            type="button"
          >
            Hide
          </button>
        </div>
      </header>

      <nav aria-label="Workflow steps" className="om-guide__stepper">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep.id;
          return (
            <button
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className={`om-guide__step-btn${isCurrent ? " is-current" : ""}${step.isComplete ? " is-complete" : ""}`}
              onClick={() => onNavigate(step.id)}
              title={`${step.label}: ${step.description}`}
              type="button"
            >
              <span className="om-guide__step-badge">
                {step.isComplete ? "✓" : String(index + 1)}
              </span>
              <span className="om-guide__step-label">{step.label}</span>
              {step.badgeText ? (
                <span className="om-guide__step-sub">{step.badgeText}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="om-guide__foot">
        <div className="om-guide__foot-copy">
          <p className="om-guide__desc">{currentStep.description}</p>
          {showsAiTip ? (
            <p className="om-guide__tip">
              Tip: the AI assistants are optional — every step works without a key.
            </p>
          ) : null}
        </div>
        <div className="om-guide__actions">
          {!isReportGenerated ? (
            <button
              className="om-button om-button--primary"
              onClick={() => onNavigate(currentStep.id)}
              type="button"
            >
              Go to {currentStep.label} →
            </button>
          ) : (
            <button
              className="om-button om-button--primary"
              onClick={() => onNavigate("Artifacts")}
              type="button"
            >
              Inspect Project Artifacts →
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
