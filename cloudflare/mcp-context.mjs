export function requireRequestProps(context) {
  if (!context.props) throw new Error('Authenticated workspace context is required.');
  return context.props;
}
