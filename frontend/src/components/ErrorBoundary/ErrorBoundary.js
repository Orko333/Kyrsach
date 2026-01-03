import React, { Component } from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h1>Щось пішло не так</h1>
            <p>Вибачте за незручності. Спробуйте оновити сторінку.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="btn btn-primary"
            >
              Оновити сторінку
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Деталі помилки</summary>
                <pre>{this.state.error?.toString()}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
