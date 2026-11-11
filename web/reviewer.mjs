const form = document.getElementById('reviewer-form');
const button = document.getElementById('reviewer-submit');
const error = document.getElementById('reviewer-error');
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  error.textContent = '';
  try {
    const response = await fetch('/auth/reviewer', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: document.getElementById('reviewer-email').value, password: document.getElementById('reviewer-password').value}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? 'Sign-in failed.');
    location.assign('/dashboard');
  } catch (failure) {
    error.textContent = failure.message;
    button.disabled = false;
  }
});
