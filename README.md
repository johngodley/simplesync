# Simple Sync

A simple tool to monitor for local file modifications and sync changes to a remote machine. Use your favourite editor locally, and run on a remote machine.

## Why?

If you need to edit files on a remote machine there are several choices:

- SSH and edit using `vi`
- Use an SFTP program and edit individual files
- Mount the remote machine using Fuse
- Use Unison

They're all suitable for different purposes. Some are slow, some don't allow you to use a local editor, and some are difficult to setup.

Simple Sync runs on your local machine and:

- Lets you edit local files at full speed using a local editor (such as VSCode) and get all the goodness out of its features
- Will monitor files for changes and sync them to a remote machine

That's it! It's faster than using Fuse, and doesn't have all the complexity of trying to get Unison to work.

## How?

Simple Sync monitors a directory for file changes and then issues a series of `scp` commands (to upload changes) or `rsync` commands (to delete files).

It will monitor:
- New files
- Updated files
- Deleted files
- New directories
- Deleted directories
- Renamed files and directories

# Installation

Clone the repo to a location where you keep code. Then install:

`npm install`

And finally:

`npm link`

You can now access the program anywhere via `simplesync`.

# To use

Simple Sync needs a local and a remote path, and will sync from the local to the remote. You can pass this on the command line:

`simplesync --local /users/john/mysite --remote john@remotemachine.com:/home/user/mysite`

- The `local` value should be a directory on your local machine.
- The `remote` should be an rsync-style SSH+path. You can use any valid Rsync format you want, including `machine:/path` if you have your SSH config setup

Optional arguments:
- `--test` - Switch on test mode and show what commands will be run, but doesn't run them. Useful to check you have everything configured right
- `--verbose` - Outputs all files that are changed and the commands that are run. Auto-enabled in `--test` mode
- `--scp` - Additional arguments to pass to `scp` (such as SSH identity file)
- `--rsync` - Additional arguments to pass to `rsync` (such as SSH identity file)

## Configuration File

You can store arguments in a configuration file called `.simplesyncrc`. This can exist in the current directory, or any parent directory up to `~/.simplesyncrc`.

It is a JSON file as follows:

```js
{
	"local": "/Users/john/simplesync/",
	"remote": "machine:/home/user/simplesync/",
	"scp": "",
	"rsync": ""
}
```

# Full Sync

If you make changes on the remote machine and want to sync them to your local machine you can run:

`simplesync down`

Similarly you can sync you local directory to the remote machine:

`simplesync up`

Note that this can delete files and local modifications - be careful and use the `--test` argument!

Also note that syncs are done relative to the directory you are in. For example, if you have `--local` set to `/home/sync` and you are in `/home/sync/subdir` then it will sync `subdir` only, and not anything else in `/home/sync`

# Caveats

Simple Sync only syncs one way from local to remote, and does not check for local modifications. If you edit a remote file, and then edit the same local file, Simple Sync will upload the local file over the remote file without warning.

It is advised you use the `--test` argument when configuring so you can see what will happen when syncing.

**Absolutley no responsability is taken for any damage caused by this program!**
