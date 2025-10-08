class Calculator {
   constructor() {
     this.display = '';
     this.previousValue = null;
     this.operation = null;
     this.waitingForNewValue = false;
   }

   appendNumber(number) {
     if (this.waitingForNewValue) {
       this.display = number;
       this.waitingForNewValue = false;
     } else {
       this.display = this.display === '0' ? number : this.display + number;
     }
   }

   appendDecimal() {
     if (this.waitingForNewValue) {
       this.display = '0.';
       this.waitingForNewValue = false;
     } else if (this.display.indexOf('.') === -1) {
       this.display += '.';
     }
   }

   chooseOperation(operation) {
     if (this.display === '') return;

     if (this.previousValue !== null) {
       this.compute();
     }

     this.operation = operation;
     this.previousValue = parseFloat(this.display);
     this.waitingForNewValue = true;
   }

   compute() {
     if (this.operation === null || this.waitingForNewValue) return;

     const current = parseFloat(this.display);
     let result;

     switch (this.operation) {
       case '+':
         result = this.previousValue + current;
         break;
       case '-':
         result = this.previousValue - current;
         break;
       case '×':
         result = this.previousValue * current;
         break;
       case '÷':
         result = this.previousValue / current;
         break;
       case '%':
         result = this.previousValue % current;
         break;
       default:
         return;
     }

     this.display = result.toString();
     this.operation = null;
     this.previousValue = null;
     this.waitingForNewValue = true;
   }

   clear() {
     this.display = '';
     this.previousValue = null;
     this.operation = null;
     this.waitingForNewValue = false;
   }

   delete() {
     this.display = this.display.slice(0, -1);
   }

   updateDisplay() {
     const displayElement = document.querySelector('.calculator-display');
     if (displayElement) {
       displayElement.textContent = this.display || '0';
     }
   }
}

let calculator = new Calculator();

export function initializeCalculator() {
   const calculatorElement = document.querySelector('.calculator');
   if (!calculatorElement) return;

   calculatorElement.addEventListener('click', handleCalculatorClick);
   calculator.updateDisplay();
}

function handleCalculatorClick(event) {
   const target = event.target;

   if (target.matches('.calculator-number')) {
     calculator.appendNumber(target.dataset.number);
     calculator.updateDisplay();
   }

   if (target.matches('.calculator-decimal')) {
     calculator.appendDecimal();
     calculator.updateDisplay();
   }

   if (target.matches('.calculator-operation')) {
     calculator.chooseOperation(target.dataset.operation);
     calculator.updateDisplay();
   }

   if (target.matches('.calculator-equals')) {
     calculator.compute();
     calculator.updateDisplay();
   }

   if (target.matches('.calculator-clear')) {
     calculator.clear();
     calculator.updateDisplay();
   }

   if (target.matches('.calculator-delete')) {
     calculator.delete();
     calculator.updateDisplay();
   }
}