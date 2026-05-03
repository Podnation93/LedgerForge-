import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { ActionButton } from '../components/ActionButton'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { captureRendererException } from '../telemetry'

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    error: null,
    errorInfo: null,
  }

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo })
    captureRendererException(error)
  }

  private copyDiagnosticInfo = async () => {
    const { error, errorInfo } = this.state
    const details = [
      `Message: ${error?.message ?? 'Unknown route error'}`,
      `Stack: ${error?.stack ?? 'Unavailable'}`,
      `Component stack: ${errorInfo?.componentStack ?? 'Unavailable'}`,
    ].join('\n\n')

    await navigator.clipboard.writeText(details)
  }

  private reloadWindow = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section className="page">
        <PageHeader title="Something went wrong" kicker="Route error" />
        <Panel title="Recovery">
          <div className="route-error">
            <p className="muted">This screen hit a rendering error. The rest of the app shell is still running.</p>
            <pre>{this.state.error.message}</pre>
            <div className="button-row left">
              <ActionButton icon={RefreshCw} label="Reload App" onClick={this.reloadWindow} />
              <ActionButton icon={Copy} label="Copy Diagnostic Info" onClick={this.copyDiagnosticInfo} />
            </div>
          </div>
        </Panel>
      </section>
    )
  }
}
