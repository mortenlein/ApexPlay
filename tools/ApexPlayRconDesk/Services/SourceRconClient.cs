using System.Net.Sockets;
using System.Text;
using System.IO;

namespace ApexPlayRconDesk.Services;

public sealed class SourceRconClient : IAsyncDisposable
{
    private const int TypeResponseValue = 0;
    private const int TypeExecCommand = 2;
    private const int TypeAuth = 3;
    private const int TypeAuthResponse = 2;

    private TcpClient? _tcp;
    private NetworkStream? _stream;
    private int _nextId = 1000;

    public bool IsConnected => _tcp?.Connected == true && _stream != null;

    public async Task ConnectAsync(string host, int port, string password, CancellationToken cancellationToken = default)
    {
        await DisconnectAsync();

        _tcp = new TcpClient();
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(5));

        await _tcp.ConnectAsync(host, port, cts.Token);
        _stream = _tcp.GetStream();
        _stream.ReadTimeout = 4000;
        _stream.WriteTimeout = 4000;

        var authId = Interlocked.Increment(ref _nextId);
        await WritePacketAsync(authId, TypeAuth, password, cts.Token);

        // Many servers send an empty response packet before auth response.
        var first = await ReadPacketAsync(cts.Token);
        if (first.Type == TypeResponseValue)
        {
            first = await ReadPacketAsync(cts.Token);
        }

        if (first.Type != TypeAuthResponse || first.Id == -1)
        {
            await DisconnectAsync();
            throw new InvalidOperationException("RCON authentication failed.");
        }
    }

    public async Task<string> ExecuteAsync(string command, CancellationToken cancellationToken = default)
    {
        if (!IsConnected || _stream == null)
        {
            throw new InvalidOperationException("RCON client is not connected.");
        }

        var requestId = Interlocked.Increment(ref _nextId);
        await WritePacketAsync(requestId, TypeExecCommand, command, cancellationToken);

        var builder = new StringBuilder();
        var timeoutAt = DateTime.UtcNow.AddMilliseconds(700);

        while (DateTime.UtcNow < timeoutAt)
        {
            if (!_stream.DataAvailable)
            {
                await Task.Delay(25, cancellationToken);
                continue;
            }

            var packet = await ReadPacketAsync(cancellationToken);
            if (packet.Id != requestId && packet.Type != TypeResponseValue)
            {
                continue;
            }

            if (!string.IsNullOrWhiteSpace(packet.Body))
            {
                if (builder.Length > 0)
                {
                    builder.AppendLine();
                }
                builder.Append(packet.Body.TrimEnd('\0'));
            }
        }

        return builder.ToString();
    }

    public async Task DisconnectAsync()
    {
        try
        {
            _stream?.Close();
            _stream?.Dispose();
            _stream = null;
        }
        catch
        {
            // Ignore close failures.
        }

        try
        {
            _tcp?.Close();
            _tcp?.Dispose();
            _tcp = null;
        }
        catch
        {
            // Ignore close failures.
        }

        await Task.CompletedTask;
    }

    private async Task WritePacketAsync(int id, int type, string body, CancellationToken cancellationToken)
    {
        if (_stream == null)
        {
            throw new InvalidOperationException("Missing network stream.");
        }

        var bodyBytes = Encoding.UTF8.GetBytes(body ?? "");
        var size = 4 + 4 + bodyBytes.Length + 2;
        var packet = new byte[4 + size];

        Buffer.BlockCopy(BitConverter.GetBytes(size), 0, packet, 0, 4);
        Buffer.BlockCopy(BitConverter.GetBytes(id), 0, packet, 4, 4);
        Buffer.BlockCopy(BitConverter.GetBytes(type), 0, packet, 8, 4);
        Buffer.BlockCopy(bodyBytes, 0, packet, 12, bodyBytes.Length);
        packet[packet.Length - 2] = 0;
        packet[packet.Length - 1] = 0;

        await _stream.WriteAsync(packet, 0, packet.Length, cancellationToken);
        await _stream.FlushAsync(cancellationToken);
    }

    private async Task<(int Id, int Type, string Body)> ReadPacketAsync(CancellationToken cancellationToken)
    {
        if (_stream == null)
        {
            throw new InvalidOperationException("Missing network stream.");
        }

        var sizeBytes = await ReadExactlyAsync(_stream, 4, cancellationToken);
        var size = BitConverter.ToInt32(sizeBytes, 0);
        if (size < 10 || size > 4096 * 16)
        {
            throw new InvalidDataException($"Invalid RCON packet size: {size}");
        }

        var payload = await ReadExactlyAsync(_stream, size, cancellationToken);
        var id = BitConverter.ToInt32(payload, 0);
        var type = BitConverter.ToInt32(payload, 4);
        var bodyLength = size - 10; // id(4) + type(4) + 2 terminators
        var body = bodyLength > 0 ? Encoding.UTF8.GetString(payload, 8, bodyLength) : "";
        return (id, type, body);
    }

    private static async Task<byte[]> ReadExactlyAsync(NetworkStream stream, int length, CancellationToken cancellationToken)
    {
        var buffer = new byte[length];
        var offset = 0;
        while (offset < length)
        {
            var read = await stream.ReadAsync(buffer, offset, length - offset, cancellationToken);
            if (read <= 0)
            {
                throw new IOException("Remote host closed RCON connection.");
            }
            offset += read;
        }
        return buffer;
    }

    public async ValueTask DisposeAsync()
    {
        await DisconnectAsync();
    }
}
