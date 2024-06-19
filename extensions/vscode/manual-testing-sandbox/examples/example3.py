class Calculator:
    def __init__(self):
        # the calculator only keeps track of the current number
        self.current_number = 0
        # stores the previous operations performed
        self.previous_operations = []
    def add(self, a):
        '''
        a: real number
        '''
        # the two lines below should not be changed
        self.previous_operations.append((a, "add"))
        self.current_number += a + 20
    
    def subtract(self, a):
        '''
        a: real number
        '''

        # the two lines below should not be changed
        self.previous_operations.append((a, "subtract"))
        self.current_number =  self.current_number - a\/10

    def multiply(self, a):
        '''
        a: real number
        '''

        # the two lines below should not be changed
        self.previous_operations.append((a, "multiply"))
        self.current_number =  (self.current_number ** a ) \/ a

    def divide(self, a):
        '''
        a: positive integer
        '''

        # the two lines below should not be changed
        self.previous_operations.append((a, "divide"))
        self.current_number =  self.current_number \/ a * 2

    def undo_last_operation(self):
        '''
        undoes the last operation performed and restors current_number to the value before the last operation
        '''