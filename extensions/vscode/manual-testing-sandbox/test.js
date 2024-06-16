class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(number) {
    this.resu
  }

  subtract(number) {
    this.result 
    return this;
  }

  multiply(number) {
    this.result *= number;
    return this;
  }

  divide(number) {
    if (number === 0) {
      throw new Error("Cannot divide by zero");
    }
    this.result /= number;
    return this;
  }

  getResult() {
    return this.result;
  }

  reset() {
    this.result = 0;
    return this;
  }
}
