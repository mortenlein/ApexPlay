using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;
using ApexPlayRconDesk.Models;
using ApexPlayRconDesk.Services;

namespace ApexPlayRconDesk;

public partial class MainWindow : Window
{
    private readonly SettingsService _settingsService = new();
    private readonly SourceRconClient _rcon = new();
    private readonly AppSettings _settings;
    private readonly ObservableCollection<ServerProfile> _servers = new();
    private readonly ObservableCollection<ActionPreset> _actions = new();
    private readonly Dictionary<string, ActionPreset> _hotkeyMap = new(StringComparer.OrdinalIgnoreCase);

    private bool _busy;

    public MainWindow()
    {
        InitializeComponent();
        _settings = _settingsService.Load();

        foreach (var server in _settings.Servers)
        {
            _servers.Add(server);
        }
        foreach (var action in _settings.Actions)
        {
            _actions.Add(action);
        }

        ServerComboBox.ItemsSource = _servers;
        ActionItemsControl.ItemsSource = _actions;
        RebuildHotkeyMap();

        if (!string.IsNullOrWhiteSpace(_settings.LastServerName))
        {
            var selected = _servers.FirstOrDefault(s => string.Equals(s.Name, _settings.LastServerName, StringComparison.OrdinalIgnoreCase));
            if (selected != null)
            {
                ServerComboBox.SelectedItem = selected;
            }
        }

        if (ServerComboBox.SelectedItem == null && _servers.Count > 0)
        {
            ServerComboBox.SelectedIndex = 0;
        }
    }

    private void OnServerSelected(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (ServerComboBox.SelectedItem is not ServerProfile profile)
        {
            return;
        }

        HostTextBox.Text = profile.Host;
        PortTextBox.Text = profile.Port.ToString();
        PasswordBox.Password = profile.RconPassword;
        ServerPasswordBox.Password = profile.ServerPassword;
        _settings.LastServerName = profile.Name;
        SaveSettings();
    }

    private async void OnConnect(object sender, RoutedEventArgs e)
    {
        if (_busy) return;
        if (ServerComboBox.SelectedItem is not ServerProfile profile)
        {
            AddLog("Select a server profile first.");
            return;
        }

        profile.Host = HostTextBox.Text.Trim();
        profile.RconPassword = PasswordBox.Password;
        profile.ServerPassword = ServerPasswordBox.Password;
        if (!int.TryParse(PortTextBox.Text.Trim(), out var parsedPort))
        {
            AddLog("Invalid port.");
            return;
        }
        profile.Port = parsedPort;
        SaveSettings();

        try
        {
            SetBusy(true);
            AddLog($"Connecting to {profile.Host}:{profile.Port} ...");
            await _rcon.ConnectAsync(profile.Host, profile.Port, profile.RconPassword);
            AddLog("Connected and authenticated.");
            ConnectButton.IsEnabled = false;
            DisconnectButton.IsEnabled = true;
        }
        catch (Exception ex)
        {
            AddLog($"Connection failed: {ex.Message}");
        }
        finally
        {
            SetBusy(false);
        }
    }

    private async void OnDisconnect(object sender, RoutedEventArgs e)
    {
        if (_busy) return;
        try
        {
            SetBusy(true);
            await _rcon.DisconnectAsync();
            AddLog("Disconnected.");
        }
        finally
        {
            SetBusy(false);
            ConnectButton.IsEnabled = true;
            DisconnectButton.IsEnabled = false;
        }
    }

    private void OnAddServer(object sender, RoutedEventArgs e)
    {
        var newName = $"Server {_servers.Count + 1}";
        var profile = new ServerProfile
        {
            Name = newName,
            Host = "127.0.0.1",
            Port = 27015
        };
        _servers.Add(profile);
        ServerComboBox.SelectedItem = profile;
        SaveSettings();
    }

    private void OnSaveServer(object sender, RoutedEventArgs e)
    {
        if (ServerComboBox.SelectedItem is not ServerProfile profile)
        {
            return;
        }

        profile.Host = HostTextBox.Text.Trim();
        profile.RconPassword = PasswordBox.Password;
        profile.ServerPassword = ServerPasswordBox.Password;
        if (int.TryParse(PortTextBox.Text.Trim(), out var parsedPort))
        {
            profile.Port = parsedPort;
        }
        SaveSettings();
        AddLog($"Saved profile: {profile.Name}");
    }

    private void OnDeleteServer(object sender, RoutedEventArgs e)
    {
        if (ServerComboBox.SelectedItem is not ServerProfile profile)
        {
            return;
        }

        var confirm = MessageBox.Show(
            $"Delete server profile '{profile.Name}'?",
            "Confirm Delete",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning);
        if (confirm != MessageBoxResult.Yes) return;

        _servers.Remove(profile);
        if (_servers.Count > 0)
        {
            ServerComboBox.SelectedIndex = 0;
        }
        SaveSettings();
    }

    private async void OnActionButtonClick(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement { Tag: ActionPreset action })
        {
            await RunActionAsync(action);
        }
    }

    private async void OnSendMacro(object sender, RoutedEventArgs e)
    {
        var script = MacroEditorTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(script))
        {
            AddLog("Macro is empty.");
            return;
        }

        await ExecuteScriptAsync("Macro", script, false, "Run this macro?");
    }

    private async void OnSendManualCommand(object sender, RoutedEventArgs e)
    {
        var command = ManualCommandTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(command))
        {
            return;
        }

        ManualCommandTextBox.Clear();
        await ExecuteScriptAsync("Manual", command, false, "Run this command?");
    }

    private void OnCopyJoinLink(object sender, RoutedEventArgs e)
    {
        if (ServerComboBox.SelectedItem is not ServerProfile profile)
        {
            AddLog("Select a server profile first.");
            return;
        }

        profile.Host = HostTextBox.Text.Trim();
        profile.ServerPassword = ServerPasswordBox.Password;
        if (!int.TryParse(PortTextBox.Text.Trim(), out var parsedPort))
        {
            AddLog("Invalid port.");
            return;
        }
        profile.Port = parsedPort;
        SaveSettings();

        var joinLink = string.IsNullOrWhiteSpace(profile.ServerPassword)
            ? $"steam://connect/{profile.Host}:{profile.Port}"
            : $"steam://connect/{profile.Host}:{profile.Port}/{profile.ServerPassword}";

        Clipboard.SetText(joinLink);
        AddLog("Copied join link to clipboard.");
    }

    private async Task RunActionAsync(ActionPreset action)
    {
        if (action == null) return;
        await ExecuteScriptAsync(action.Name, action.CommandScript, action.Confirm, action.ConfirmMessage);
    }

    private async Task ExecuteScriptAsync(string actionName, string script, bool requireConfirm, string confirmMessage)
    {
        if (_busy)
        {
            AddLog("Busy. Wait for current command to complete.");
            return;
        }
        if (!_rcon.IsConnected)
        {
            AddLog("Not connected to RCON.");
            return;
        }

        if (requireConfirm)
        {
            var confirm = MessageBox.Show(confirmMessage, $"Confirm: {actionName}", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (confirm != MessageBoxResult.Yes)
            {
                AddLog($"Canceled action: {actionName}");
                return;
            }
        }

        var commands = script
            .Split(new[] { '\r', '\n', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .ToList();

        if (commands.Count == 0)
        {
            AddLog($"No commands to run for {actionName}.");
            return;
        }

        try
        {
            SetBusy(true);
            AddLog($"Running action: {actionName}");
            foreach (var command in commands)
            {
                AddLog($"> {command}");
                var output = await _rcon.ExecuteAsync(command);
                if (!string.IsNullOrWhiteSpace(output))
                {
                    AddLog(output);
                }
            }
            AddLog($"Completed: {actionName}");
        }
        catch (Exception ex)
        {
            AddLog($"Action failed ({actionName}): {ex.Message}");
        }
        finally
        {
            SetBusy(false);
        }
    }

    private async void OnWindowKeyDown(object sender, KeyEventArgs e)
    {
        var stroke = BuildStroke(e);
        if (string.IsNullOrWhiteSpace(stroke))
        {
            return;
        }

        if (_hotkeyMap.TryGetValue(stroke, out var action))
        {
            e.Handled = true;
            await RunActionAsync(action);
        }
    }

    private static string BuildStroke(KeyEventArgs e)
    {
        var parts = new List<string>();
        var modifiers = Keyboard.Modifiers;
        if ((modifiers & ModifierKeys.Control) != 0) parts.Add("Ctrl");
        if ((modifiers & ModifierKeys.Shift) != 0) parts.Add("Shift");
        if ((modifiers & ModifierKeys.Alt) != 0) parts.Add("Alt");

        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (key is Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LeftShift or Key.RightShift)
        {
            return "";
        }

        parts.Add(key.ToString().ToUpperInvariant());
        return string.Join("+", parts);
    }

    private void RebuildHotkeyMap()
    {
        _hotkeyMap.Clear();
        var pretty = new List<string>();
        foreach (var action in _actions)
        {
            var normalized = NormalizeHotkey(action.Hotkey);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                continue;
            }

            _hotkeyMap[normalized] = action;
            pretty.Add(normalized);
        }

        HotkeyHintText.Text = pretty.Count > 0
            ? $"Hotkeys: {string.Join(", ", pretty)}"
            : "No hotkeys configured.";
    }

    private static string NormalizeHotkey(string? hotkey)
    {
        if (string.IsNullOrWhiteSpace(hotkey))
        {
            return "";
        }

        return string.Join("+", hotkey
            .Split('+', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(part =>
            {
                if (part.Equals("control", StringComparison.OrdinalIgnoreCase)) return "Ctrl";
                return part.Length <= 1 ? part.ToUpperInvariant() : char.ToUpperInvariant(part[0]) + part[1..].ToLowerInvariant();
            }));
    }

    private void AddLog(string message)
    {
        var line = $"[{DateTime.Now:HH:mm:ss}] {message}";
        LogListBox.Items.Insert(0, line);
    }

    private void SetBusy(bool busy)
    {
        _busy = busy;
        SendMacroButton.IsEnabled = !busy;
        ConnectButton.IsEnabled = !busy && !_rcon.IsConnected;
        DisconnectButton.IsEnabled = !busy && _rcon.IsConnected;
    }

    private void SaveSettings()
    {
        _settings.Servers = _servers.ToList();
        _settings.Actions = _actions.ToList();
        if (ServerComboBox.SelectedItem is ServerProfile selected)
        {
            _settings.LastServerName = selected.Name;
        }
        _settingsService.Save(_settings);
        RebuildHotkeyMap();
    }

    protected override async void OnClosed(EventArgs e)
    {
        await _rcon.DisposeAsync();
        base.OnClosed(e);
    }
}
