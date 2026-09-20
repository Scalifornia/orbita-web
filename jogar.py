"""Abre o Órbita no navegador. Executa este ficheiro no PyCharm ou com Python 3."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import webbrowser


def main():
    folder = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(folder))
    port = 8765
    try:
        server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    except OSError as error:
        print(f"Não foi possível abrir a porta {port}: {error}")
        print("Se o jogo já estiver ligado, abre http://localhost:8765 no navegador.")
        return
    print(f"\nÓRBITA — http://localhost:{port}")
    try:
        addresses = sorted({entry[4][0] for entry in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)})
        for address in addresses:
            if not address.startswith("127."):
                print(f"No telemóvel, na mesma rede Wi-Fi: http://{address}:{port}")
    except OSError:
        print(f"No telemóvel: http://<IP local deste computador>:{port}")
    print("Mantém esta janela aberta enquanto jogas. Usa Ctrl+C ou Parar para sair.\n")
    webbrowser.open(f"http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nMissão terminada. Até à próxima!")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
