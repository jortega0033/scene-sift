import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@renderer/app/ErrorBoundary';

const Thrower = () => {
  throw new Error('boom');
};

describe('error boundary', () => {
  it('shows fallback UI when child throws', () => {
    const originalError = console.error;
    console.error = () => undefined;

    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    console.error = originalError;
  });
});
