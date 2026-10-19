from src.pipeline import main

if __name__ == '__main__':
    result = main()
    raise SystemExit(result if isinstance(result,int) else 0)
