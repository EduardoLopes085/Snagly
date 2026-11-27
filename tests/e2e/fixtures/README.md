# Mídia de teste

`clip.mp4` contém meio segundo de imagem preta e um tom de 440 Hz. É uma
amostra sintética usada para comparar os bytes do download concluído.
Os testes leem o arquivo incluído no repositório.

Para reproduzir a amostra com FFmpeg, execute na raiz do projeto.

```sh
ffmpeg -v error -f lavfi -i color=c=black:s=32x32:r=10:d=0.5 -f lavfi -i sine=frequency=440:duration=0.5 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart tests/e2e/fixtures/clip.mp4
```
