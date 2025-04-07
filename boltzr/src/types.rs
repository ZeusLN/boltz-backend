pub trait Bool {}

#[derive(Copy, Clone, Debug)]
pub struct True {}

#[derive(Copy, Clone, Debug)]
pub struct False {}

impl Bool for True {}
impl Bool for False {}
