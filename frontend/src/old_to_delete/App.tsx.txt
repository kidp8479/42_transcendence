import { useState } from 'react'

const features = [
  {
    tag: 'Kanban Board',
    title: 'Visualize your project like never before',
    description:
      'Drag-and-drop tickets across customizable columns. Assign teammates, set deadlines, and track progress - all in one view. Built for the fast pace of 42 project sprints.',
    image:
      'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=1200&h=760&fit=crop&auto=format',
  },
  {
    tag: 'Status monitor',
    title: 'Keep every milestone visible',
    description:
      'Follow evaluation readiness, owner handoffs, blockers, and project health from a single shared workspace built for student teams.',
    image:
      'https://images.unsplash.com/photo-1625838144804-300f3907c110?w=1200&h=760&fit=crop&auto=format',
  },
  {
    tag: 'Discovery',
    title: 'Start with the structure your team needs',
    description:
      'Collect requirements, assign roles, keep references nearby, and turn early research into a board your whole group can act on.',
    image:
      'https://images.unsplash.com/photo-1629904853893-c2c8981a1dc5?w=1200&h=760&fit=crop&auto=format',
  },
]

const boardColumns = [
  {
    label: 'TODO',
    accent: '#8b5cf6',
    cards: ['Initial research', 'Setup repo', 'Read subject.pdf'],
  },
  {
    label: 'IN PROGRESS',
    accent: '#38bdf8',
    cards: ['User authentication', 'Database schema'],
  },
  {
    label: 'REVIEW',
    accent: '#f59e0b',
    cards: ['API endpoints'],
  },
  {
    label: 'COMPLETED',
    accent: '#10b981',
    cards: ['Project initialization', 'Environment setup'],
  },
]

export default function App() {
  const [activeFeature, setActiveFeature] = useState(0)
  const feature = features[activeFeature]

  return (
    <main className="landing-page">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Transcendence home">
          <span className="brand-mark">TP</span>
          <span className="brand-name">TRANSCENDENCE</span>
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#about">About</a>
        </nav>

        <div className="header-actions">
          <a className="button button-primary" href="#create-account">
            Create Account
          </a>
          <a className="button button-secondary" href="#workspace">
            <span>Enter Workspace</span>
            <span aria-hidden="true">-&gt;</span>
          </a>
        </div>
      </header>

      <section id="top" className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">For 42 students</p>
          <h1 id="hero-title">
            Plan. <span>Track.</span>
            <br />
            Ship.
          </h1>
          <p className="hero-description">
            Transcendence Planner is a project management workspace built for 42
            students. Stay organised, align with your team, and ship great
            projects.
          </p>
          <div className="hero-actions">
            <a className="button button-primary button-large" href="#workspace">
              <span>Enter Workspace</span>
              <span aria-hidden="true">-&gt;</span>
            </a>
            <a className="button button-ghost button-large" href="#features">
              View Demo
            </a>
          </div>
        </div>

        <div className="hero-preview" aria-label="Workspace preview">
          <div className="preview-browser">
            <div className="preview-topbar">
              <div className="preview-brand">
                <span className="preview-logo">TP</span>
                <strong>Transcendence Planner</strong>
              </div>
              <div className="preview-links">
                <span>Features</span>
                <span>How it works</span>
                <span>About</span>
              </div>
            </div>
            <div className="preview-body">
              <div className="preview-intro">
                <h2>
                  Plan. Track.
                  <br />
                  <span>Ship.</span>
                </h2>
                <p>
                  Stay organised, align with your team, and ship great projects.
                </p>
                <button type="button">Enter Workspace -&gt;</button>
              </div>
              <div className="board-card">
                <aside className="board-sidebar">
                  <span className="preview-logo">TP</span>
                  <div>Discovery</div>
                  <div>Board</div>
                  <div>Team</div>
                  <div>Calendar</div>
                </aside>
                <div className="board-content">
                  <div className="board-title-row">
                    <strong>My Project</strong>
                    <div className="avatars" aria-hidden="true">
                      <span>AM</span>
                      <span>SL</span>
                      <span>Y</span>
                    </div>
                  </div>
                  <div className="columns">
                    {boardColumns.map((column) => (
                      <div className="column" key={column.label}>
                        <h3 style={{ color: column.accent }}>{column.label}</h3>
                        {column.cards.map((card) => (
                          <p key={card}>{card}</p>
                        ))}
                        <small>+ Add task</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="preview-footer">Discovery</div>
          </div>
        </div>
      </section>

      <section id="features" className="feature-section" aria-labelledby="features-title">
        <p className="section-kicker">Discovery</p>
        <h2 id="features-title">
          Everything you need to understand and structure your project
        </h2>

        <article className="feature-card" id="how-it-works">
          <div className="feature-image-wrap">
            <img src={feature.image} alt="Project planning workspace" />
            <span className="feature-tag">{feature.tag}</span>
          </div>
          <div className="feature-copy">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <div className="carousel-controls" aria-label="Feature carousel controls">
              <button
                type="button"
                onClick={() =>
                  setActiveFeature((activeFeature + features.length - 1) % features.length)
                }
                aria-label="Previous feature"
              >
                &lt;
              </button>
              <div className="carousel-dots" aria-label="Feature slides">
                {features.map((item, index) => (
                  <button
                    key={item.tag}
                    type="button"
                    className={index === activeFeature ? 'active' : ''}
                    onClick={() => setActiveFeature(index)}
                    aria-label={`Show ${item.tag}`}
                    aria-current={index === activeFeature}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveFeature((activeFeature + 1) % features.length)}
                aria-label="Next feature"
              >
                &gt;
              </button>
            </div>
          </div>
        </article>
      </section>

      <footer id="about" className="site-footer">
        <a href="#privacy">privacy policy</a>
        <span>|</span>
        <a href="#contact">contact</a>
        <span>|</span>
        <a href="#about">about</a>
        <span>|</span>
        <a href="#terms">Terms of Service</a>
      </footer>
    </main>
  )
}
