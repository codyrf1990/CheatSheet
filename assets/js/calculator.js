const state = {
  displayValue: '0',
  firstOperand: null,
  waitingForSecondOperand: false,
  operator: null,
  error: false,
  // When true, the next numeric input should start a new entry
  justEvaluated: false,
};

export function initializeCalculator() {
  const calculatorElement = document.querySelector('.calculator');
  const displayElement = document.querySelector('.calculator-display');
  if (!calculatorElement || !displayElement) return;

  calculatorElement.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;

    const { number } = button.dataset;
    const { operation } = button.dataset;
    const action = button.dataset.action;
    const percentValue = button.dataset.percent;

    if (number !== undefined) {
      inputDigit(number);
      updateDisplay(displayElement);
      return;
    }

    if (operation) {
      handleOperator(operation);
      updateDisplay(displayElement);
      return;
    }

    if (percentValue !== undefined) {
      handleQuickPercent(parseFloat(percentValue));
      updateDisplay(displayElement);
      return;
    }

    switch (action) {
      case 'decimal':
        inputDecimal();
        break;
      case 'equals':
        handleEquals();
        break;
      case 'clear':
        handleClear();
        break;
      case 'delete':
        handleDelete();
        break;
      case 'sign':
        handleToggleSign();
        break;
      case 'percent':
        handlePercent();
        break;
      default:
        break;
    }

    updateDisplay(displayElement);
  });

  updateDisplay(displayElement);
}

function inputDigit(digit) {
  if (state.error) {
    resetState();
  }

  // If the last action was '=' and user enters a digit, start fresh
  if (state.justEvaluated) {
    state.displayValue = digit;
    state.firstOperand = null;
    state.operator = null;
    state.waitingForSecondOperand = false;
    state.error = false;
    state.justEvaluated = false;
    return;
  }

  if (state.waitingForSecondOperand) {
    state.displayValue = digit;
    state.waitingForSecondOperand = false;
  } else {
    if (state.displayValue === '0') {
      state.displayValue = digit;
    } else if (state.displayValue === '-0') {
      state.displayValue = '-' + digit;
    } else {
      state.displayValue += digit;
    }
  }
}

function inputDecimal() {
  if (state.error) {
    resetState();
  }

  if (state.waitingForSecondOperand) {
    state.displayValue = '0.';
    state.waitingForSecondOperand = false;
    return;
  }

  if (!state.displayValue.includes('.')) {
    state.displayValue += '.';
  }
}

function handleOperator(nextOperator) {
  if (state.error) return;

  // Using the displayed result to continue a new operation
  if (state.justEvaluated) {
    state.justEvaluated = false;
  }

  const inputValue = parseFloat(state.displayValue);
  if (Number.isNaN(inputValue)) return;

  if (state.operator && state.waitingForSecondOperand) {
    state.operator = nextOperator;
    return;
  }

  if (state.firstOperand === null) {
    state.firstOperand = inputValue;
  } else if (state.operator) {
    const result = performCalculation(state.operator, state.firstOperand, inputValue);
    if (result === null) {
      setError();
      return;
    }
    const formatted = formatResult(result);
    if (formatted === 'Error') {
      setError();
      return;
    }
    state.displayValue = formatted;
    state.firstOperand = result;
    state.error = false;
  }

  state.operator = nextOperator;
  state.waitingForSecondOperand = true;
}

function handleEquals() {
  if (state.error || state.operator === null || state.waitingForSecondOperand) return;

  const inputValue = parseFloat(state.displayValue);
  if (Number.isNaN(inputValue)) return;

  const result = performCalculation(state.operator, state.firstOperand, inputValue);
  if (result === null) {
    setError();
    return;
  }

  const formatted = formatResult(result);
  if (formatted === 'Error') {
    setError();
    return;
  }

  state.displayValue = formatted;
  state.firstOperand = null;
  state.operator = null;
  state.waitingForSecondOperand = false;
  state.error = false;
  state.justEvaluated = true;
}

function handleClear() {
  resetState();
}

function handleDelete() {
  if (state.error) {
    resetState();
    return;
  }

  if (state.waitingForSecondOperand) return;

  if (state.displayValue.length > 1) {
    state.displayValue = state.displayValue.slice(0, -1);
    if (state.displayValue === '-' || state.displayValue === '-0' || state.displayValue === '') {
      state.displayValue = '0';
    }
  } else {
    state.displayValue = '0';
  }
}

function handleToggleSign() {
  if (state.error) return;
  if (state.waitingForSecondOperand) {
    state.displayValue = '-0';
    state.waitingForSecondOperand = false;
    return;
  }

  if (state.displayValue === '0' || state.displayValue === '-0') {
    state.displayValue = state.displayValue.startsWith('-') ? '0' : '-0';
    return;
  }

  const value = parseFloat(state.displayValue);
  if (Number.isNaN(value)) return;
  const formatted = formatResult(-value);
  if (formatted === 'Error') {
    setError();
    return;
  }
  state.displayValue = formatted;
  state.error = false;
}

function handlePercent() {
  if (state.error) return;
  const value = parseFloat(state.displayValue);
  if (Number.isNaN(value)) return;

  let result = value / 100;
  if (state.operator && state.firstOperand !== null && !state.waitingForSecondOperand) {
    result = (state.firstOperand * value) / 100;
  }

  const formatted = formatResult(result);
  if (formatted === 'Error') {
    setError();
    return;
  }

  state.displayValue = formatted;
  state.waitingForSecondOperand = false;
  state.error = false;
}

function resetState() {
  state.displayValue = '0';
  state.firstOperand = null;
  state.waitingForSecondOperand = false;
  state.operator = null;
  state.error = false;
  state.justEvaluated = false;
}

function setError() {
  state.displayValue = 'Error';
  state.firstOperand = null;
  state.waitingForSecondOperand = false;
  state.operator = null;
  state.error = true;
}

function performCalculation(operator, firstOperand, secondOperand) {
  switch (operator) {
    case '+':
      return firstOperand + secondOperand;
    case '-':
      return firstOperand - secondOperand;
    case '*':
      return firstOperand * secondOperand;
    case '/':
      return secondOperand === 0 ? null : firstOperand / secondOperand;
    default:
      return secondOperand;
  }
}

function formatResult(value) {
  if (value === null || !Number.isFinite(value)) {
    return 'Error';
  }

  const rounded = Math.round((value + Number.EPSILON) * 1e12) / 1e12;
  let text = rounded.toString();

  if (text.includes('e')) {
    return text;
  }

  if (text.includes('.')) {
    text = text.replace(/\.?0+$/, '');
  }

  return text;
}

function handleQuickPercent(percent) {
  if (!Number.isFinite(percent) || Number.isNaN(percent)) return;
  if (state.error) return;

  let baseValue;
  let usedAsSecondOperand = false;
  if (state.waitingForSecondOperand && state.firstOperand !== null) {
    baseValue = state.firstOperand;
    usedAsSecondOperand = true;
  } else {
    baseValue = parseFloat(state.displayValue);
  }

  if (Number.isNaN(baseValue)) return;

  const result = (baseValue * percent) / 100;
  const formatted = formatResult(result);
  if (formatted === 'Error') {
    setError();
    return;
  }

  state.displayValue = formatted;
  state.error = false;

  if (usedAsSecondOperand) {
    state.waitingForSecondOperand = false;
    return;
  }

  state.firstOperand = null;
  state.operator = null;
  state.waitingForSecondOperand = false;
}

function updateDisplay(displayElement) {
  displayElement.textContent = state.displayValue;
}
