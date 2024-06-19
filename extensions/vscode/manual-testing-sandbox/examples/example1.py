class Tokenizer:
    def __init__(self, max_vocab_size=200):
        self.max_vocab_size = max_vocab_size
        self.word_to_id = {}
        self.id_to_word = {}

    def tokenize(self, text):
        # do not change
        # Split text into words by spaces
        return text.lower().split()

    def build_vocabulary(self, corpus):
        """
        corpus: a list of strings (string denotes a sentence composed of words seperated by spaces)
        """
        # Count the frequency of each word in the corpus
        # WRITE CODE HERE
        
