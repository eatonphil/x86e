int fibonacci(int n) {
  int a, b = 0, current = 1;

  for (int i = 1; i < n; i++) {
    a = b;
    b = current;
    current = a + b;
  }

  return current;
}

int main() { return fibonacci(7); } // Should be 13
