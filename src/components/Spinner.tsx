interface SpinnerProps {
  size?: number;
  light?: boolean;
}

const Spinner = ({ size = 48, light = false }: SpinnerProps) => (
  <div
    role="status"
    aria-label="Loading"
    style={{ width: size, height: size }}
    className={`animate-spin rounded-full border-4 border-t-transparent ${
      light ? "border-white" : "border-sky-500"
    }`}
  />
);

export default Spinner;
