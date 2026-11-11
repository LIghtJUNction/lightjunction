//! Stream to official encryption tools using only the bundled public keys.

use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, IsTerminal, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{Error, args::Options};

const AGE_RECIPIENTS: &str = include_str!("../keys/age-recipients.txt");
const GPG_PUBLIC_KEY: &str = include_str!("../keys/pubkey.asc");
static NEXT_TEMPORARY: AtomicU64 = AtomicU64::new(0);

pub fn encrypt(options: &Options<'_>) -> Result<(), Error> {
    let protocol = options.subject.ok_or_else(|| {
        Error::Usage("Choose an encryption format: lightjunction encrypt age|gpg".into())
    })?;
    if !matches!(protocol, "age" | "gpg") {
        return Err(Error::Usage("Encryption format must be age or gpg".into()));
    }

    let input = file_path(options.input);
    let output = file_path(options.output);
    if input.is_none() && io::stdin().is_terminal() {
        return Err(Error::Usage(
            "Pipe input to encrypt, or provide --input FILE".into(),
        ));
    }
    if output.is_none() && io::stdout().is_terminal() && !options.armor {
        return Err(Error::Usage(
            "Binary ciphertext needs --output FILE or a pipe; use --armor for terminal output"
                .into(),
        ));
    }

    let input = match input {
        Some(path) => Stdio::from(File::open(path)?),
        None => Stdio::inherit(),
    };
    let staged = output.map(StagedOutput::new).transpose()?;
    let (mut command, _private_home) = backend(protocol)?;
    if options.armor {
        command.arg("--armor");
    }
    // Files are passed as handles, never shell words or backend option arguments.
    command.stdin(input).stderr(Stdio::inherit());
    command.stdout(match &staged {
        Some(staged) => staged.stdout()?,
        None => Stdio::inherit(),
    });
    let status = command.status().map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            Error::Runtime(match protocol {
                "age" => "age was not found. Install age 1.1+ and age-plugin-yubikey, and put both executables on PATH.".into(),
                _ => "gpg was not found. Install GnuPG 2.2+ and put gpg on PATH.".into(),
            })
        } else {
            Error::Runtime(format!("Could not start {protocol}: {error}"))
        }
    })?;
    if !status.success() {
        let requirement = match protocol {
            "age" => "Requires age 1.1+ and age-plugin-yubikey on PATH.",
            _ => "Requires GnuPG 2.2+ with --recipient-file support.",
        };
        return Err(Error::Runtime(format!(
            "{protocol} encryption failed ({status}). {requirement} See its diagnostic above."
        )));
    }
    if let Some(staged) = staged {
        staged.commit()?;
    }
    Ok(())
}

fn file_path(value: Option<&OsStr>) -> Option<&Path> {
    value
        .filter(|value| *value != OsStr::new("-"))
        .map(Path::new)
}

fn backend(protocol: &str) -> Result<(Command, Option<PrivateDirectory>), Error> {
    if protocol == "age" {
        let mut command = Command::new("age");
        command.arg("--encrypt");
        for recipient in AGE_RECIPIENTS.lines().map(str::trim) {
            if !recipient.is_empty() && !recipient.starts_with('#') {
                command.arg("--recipient").arg(recipient);
            }
        }
        command.args(["--output", "-"]);
        return Ok((command, None));
    }

    let home = PrivateDirectory::new()?;
    let key_path = home.path.join("recipient.asc");
    let mut public_key = create_file(&key_path)?;
    public_key.write_all(GPG_PUBLIC_KEY.as_bytes())?;
    drop(public_key);
    let mut command = Command::new("gpg");
    command.arg("--no-options").arg("--homedir").arg(&home.path);
    command.env("GNUPGHOME", &home.path);
    command.args([
        "--batch",
        "--no-tty",
        "--no-autostart",
        "--no-keyring",
        "--no-encrypt-to",
        "--no-auto-key-retrieve",
        "--no-auto-key-import",
        "--auto-key-locate",
        "clear",
        "--disable-dirmngr",
        "--recipient-file",
    ]);
    command.arg(key_path).args(["--encrypt", "--output", "-"]);
    Ok((command, Some(home)))
}

fn temporary_name() -> String {
    let tick = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let counter = NEXT_TEMPORARY.fetch_add(1, Ordering::Relaxed);
    format!(".lightjunction-{}-{tick:x}-{counter:x}", std::process::id())
}

fn create_file(path: &Path) -> io::Result<File> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}

struct PrivateDirectory {
    path: PathBuf,
}

impl PrivateDirectory {
    fn new() -> io::Result<Self> {
        let temporary = std::env::temp_dir();
        let base = if temporary.is_absolute() {
            temporary
        } else {
            std::env::current_dir()?.join(temporary)
        };
        for _ in 0..64 {
            let path = base.join(temporary_name());
            let mut builder = fs::DirBuilder::new();
            #[cfg(unix)]
            {
                use std::os::unix::fs::DirBuilderExt;
                builder.mode(0o700);
            }
            match builder.create(&path) {
                Ok(()) => return Ok(Self { path }),
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "Could not create a private temporary directory",
        ))
    }
}

impl Drop for PrivateDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

struct StagedOutput {
    temporary: PathBuf,
    target: PathBuf,
    file: Option<File>,
}

impl StagedOutput {
    fn new(target: &Path) -> io::Result<Self> {
        match fs::symlink_metadata(target) {
            Ok(_) => {
                return Err(io::Error::new(
                    io::ErrorKind::AlreadyExists,
                    "Output already exists; choose a new path",
                ));
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
        let parent = target
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        for _ in 0..64 {
            let temporary = parent.join(temporary_name());
            match create_file(&temporary) {
                Ok(file) => {
                    return Ok(Self {
                        temporary,
                        target: target.to_owned(),
                        file: Some(file),
                    });
                }
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "Could not create a ciphertext staging file",
        ))
    }

    fn stdout(&self) -> io::Result<Stdio> {
        self.file
            .as_ref()
            .ok_or_else(|| io::Error::other("Ciphertext staging file is closed"))?
            .try_clone()
            .map(Stdio::from)
    }

    fn commit(mut self) -> io::Result<()> {
        if let Some(file) = self.file.take() {
            file.sync_all()?;
            drop(file);
        }
        // Unlike rename, hard_link fails if target appeared while encryption ran.
        fs::hard_link(&self.temporary, &self.target).map_err(|error| {
            io::Error::new(error.kind(), format!("Could not publish ciphertext without overwriting a file: {error}. The output filesystem must support hard links."))
        })
        // Drop removes the staging name; the successful target link remains.
    }
}

impl Drop for StagedOutput {
    fn drop(&mut self) {
        drop(self.file.take());
        let _ = fs::remove_file(&self.temporary);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failed_or_cancelled_output_never_creates_a_target() {
        let directory = PrivateDirectory::new().unwrap();
        let target = directory.path.join("message.age");
        let mut staged = StagedOutput::new(&target).unwrap();
        staged
            .file
            .as_mut()
            .unwrap()
            .write_all(b"partial ciphertext")
            .unwrap();
        let temporary = staged.temporary.clone();
        assert!(!target.exists());
        drop(staged);
        assert!(!target.exists());
        assert!(!temporary.exists());
    }

    #[test]
    fn output_publication_refuses_a_destination_created_during_encryption() {
        let directory = PrivateDirectory::new().unwrap();
        let target = directory.path.join("message.age");
        let mut staged = StagedOutput::new(&target).unwrap();
        staged
            .file
            .as_mut()
            .unwrap()
            .write_all(b"ciphertext")
            .unwrap();
        let temporary = staged.temporary.clone();
        fs::write(&target, b"keep this existing file").unwrap();
        assert!(staged.commit().is_err());
        assert_eq!(fs::read(&target).unwrap(), b"keep this existing file");
        assert!(!temporary.exists());
        assert!(StagedOutput::new(&target).is_err());
    }

    #[test]
    fn successful_output_is_complete_and_temporary_files_are_removed() {
        let directory = PrivateDirectory::new().unwrap();
        let target = directory.path.join("message.gpg");
        let mut staged = StagedOutput::new(&target).unwrap();
        staged
            .file
            .as_mut()
            .unwrap()
            .write_all(b"complete ciphertext")
            .unwrap();
        let temporary = staged.temporary.clone();
        staged.commit().unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"complete ciphertext");
        assert!(!temporary.exists());
        let directory_path = directory.path.clone();
        drop(directory);
        assert!(!directory_path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn temporary_directories_and_output_files_are_private() {
        use std::os::unix::fs::PermissionsExt;
        let directory = PrivateDirectory::new().unwrap();
        assert_eq!(
            fs::metadata(&directory.path).unwrap().permissions().mode() & 0o777,
            0o700
        );
        let target = directory.path.join("message.age");
        let staged = StagedOutput::new(&target).unwrap();
        assert_eq!(
            fs::metadata(&staged.temporary)
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }

    #[test]
    fn dash_selects_standard_streams() {
        assert!(file_path(None).is_none());
        assert!(file_path(Some(OsStr::new("-"))).is_none());
        assert_eq!(
            file_path(Some(OsStr::new("file with spaces"))),
            Some(Path::new("file with spaces"))
        );
    }
}
