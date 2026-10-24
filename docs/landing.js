const workspace = document.querySelector('.workspace');
const sideButtons = document.querySelectorAll('button[data-side]');
const status = document.querySelector('#demo-status');

for (const button of sideButtons) {
  button.addEventListener('click', () => {
    const side = button.dataset.side;
    workspace.dataset.side = side;
    for (const choice of sideButtons) {
      choice.setAttribute('aria-pressed', String(choice === button));
    }
    status.textContent = `${side === 'right' ? 'Right' : 'Left'} sidebar selected in preview.`;
  });
}
