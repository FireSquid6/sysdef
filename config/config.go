package config

type SysdefConfig = struct {
}

type ManagerConfig = struct {
	Install       string `yaml:"install"`
	Uninstall     string `yaml:"uninstall"`
	Update        string `yaml:"update"`
	ListInstalled string `yaml:"list"`
}

func ReadConfig() {

}
